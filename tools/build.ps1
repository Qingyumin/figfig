param(
    [string]$ProjectRoot
)
$ErrorActionPreference = 'Stop'

$root = if ($ProjectRoot) { $ProjectRoot } else { Split-Path $PSScriptRoot -Parent }
$workspaceRoot = Resolve-Path (Join-Path $root '..\..')
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$node = if ($nodeCmd) { $nodeCmd.Source } else { (Resolve-Path (Join-Path $workspaceRoot '.venv\Lib\site-packages\playwright\driver\node.exe')).Path }

& $node (Join-Path $root 'tools\build.mjs')
if ($LASTEXITCODE -ne 0) { throw "Web bundle build failed ($LASTEXITCODE)." }

$pkg = Get-Content (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$version = $pkg.version
$releaseRoot = Join-Path $root 'release'
$releaseName = 'FigFig-' + $version
$release = Join-Path $releaseRoot $releaseName
$buildDir = Join-Path $root '.build'

if (Get-Process FigFig -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq (Join-Path $release 'FigFig.exe') }) {
    throw 'Close this release window before rebuilding it. Other versions will not be stopped.'
}

[void][IO.Directory]::CreateDirectory($buildDir)
[void][IO.Directory]::CreateDirectory($release)

$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'

# 1. Compile & run C# native read-only safety tests
& $compiler /nologo /codepage:65001 /target:exe /reference:System.Web.Extensions.dll /out:"$buildDir\FigFigTests.exe" "$root\native\FigFigStore.cs" "$root\native\FigFigTests.cs"
if ($LASTEXITCODE -ne 0) { throw "FigFigTests compilation failed." }
& "$buildDir\FigFigTests.exe"
if ($LASTEXITCODE -ne 0) { throw "FigFigTests execution failed." }

# 2. Copy WebView2 SDK assemblies
$sdk = Join-Path $workspaceRoot 'output\inkloom\vendor\inklet\.tools\webview2'
if (-not (Test-Path $sdk)) {
    throw "WebView2 SDK not found at $sdk"
}
Copy-Item "$sdk\lib\net462\Microsoft.Web.WebView2.Core.dll" $release -Force
Copy-Item "$sdk\lib\net462\Microsoft.Web.WebView2.WinForms.dll" $release -Force
Copy-Item "$sdk\runtimes\win-x64\native\WebView2Loader.dll" $release -Force
Copy-Item "$sdk\LICENSE.txt" (Join-Path $root 'licenses\WebView2-LICENSE.txt') -Force
Copy-Item (Join-Path $root 'assets\FigFig.ico') (Join-Path $release 'FigFig.ico') -Force
Copy-Item (Join-Path $root 'assets\FigFig-light.ico') (Join-Path $release 'FigFig-light.ico') -Force
Copy-Item (Join-Path $root 'assets\FigFig-dark.ico') (Join-Path $release 'FigFig-dark.ico') -Force

# 3. Compile FigFig.exe native Windows x64 executable
& $compiler /nologo /codepage:65001 /target:winexe /platform:x64 /optimize+ /win32icon:"$release\FigFig.ico" /reference:System.Web.dll /reference:System.Web.Extensions.dll /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:"$release\Microsoft.Web.WebView2.Core.dll" /reference:"$release\Microsoft.Web.WebView2.WinForms.dll" /out:"$release\FigFig.exe" "$root\native\FigFigStore.cs" "$root\native\FigFigApp.cs"
if ($LASTEXITCODE -ne 0) { throw "FigFig.exe compilation failed." }

# 4. Copy app assets, licenses, and documentation
$appTarget = Join-Path $release 'app'
if (Test-Path $appTarget) { Remove-Item $appTarget -Recurse -Force }
Copy-Item (Join-Path $root 'dist') $appTarget -Recurse -Force

$licTarget = Join-Path $release 'licenses'
if (Test-Path $licTarget) { Remove-Item $licTarget -Recurse -Force }
Copy-Item (Join-Path $root 'licenses') $licTarget -Recurse -Force

$mcpTarget = Join-Path $release 'mcp'
if (Test-Path $mcpTarget) { Remove-Item $mcpTarget -Recurse -Force }
Copy-Item (Join-Path $root 'mcp') $mcpTarget -Recurse -Force

$vendorTarget = Join-Path $release 'vendor'
[void][IO.Directory]::CreateDirectory($vendorTarget)
Copy-Item (Join-Path $root 'vendor\resvg.cjs') (Join-Path $vendorTarget 'resvg.cjs') -Force
Copy-Item (Join-Path $root 'vendor\resvg.wasm') (Join-Path $vendorTarget 'resvg.wasm') -Force

Copy-Item (Join-Path $root 'README.md') $release -Force
Copy-Item (Join-Path $root 'LICENSE') $release -Force
Copy-Item (Join-Path $root 'THIRD-PARTY-NOTICES.txt') $release -Force

# 5. Create portable ZIP package
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = Join-Path $releaseRoot ($releaseName + '-Windows-x64.zip')
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
[IO.Compression.ZipFile]::CreateFromDirectory($release, $zipPath, [IO.Compression.CompressionLevel]::Optimal, $true)

Write-Output ("FIGFIG_BUILD_OK " + (Join-Path $release 'FigFig.exe'))
