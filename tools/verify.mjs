import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(rootDir, "../..");
const distDir = path.join(rootDir, "dist");
const version = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8")).version;
const releaseDir = path.join(rootDir, "release", `FigFig-${version}`);
const verDir = path.join(os.tmpdir(), `figfig-verify-${version}-${Date.now()}`);

fs.mkdirSync(verDir, { recursive: true });

const requireCjs = createRequire(import.meta.url);
const workerEngine = requireCjs(path.join(releaseDir, "app/worker.cjs"));
assert(sha256File(path.join(distDir, "worker.cjs")) === sha256File(path.join(releaseDir, "app/worker.cjs")), "Packaged renderer must match source build.");

function assert(condition, message) {
  if (!condition) throw new Error(`VERIFY_ASSERT_FAILED: ${message}`);
}

function sha256File(filePath) {
  const bytes = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

const report = {
  timestamp: new Date().toISOString(),
  version,
  checks: {},
  benchmarks: {},
  artifacts: {}
};

// ============================================================================
// 1. Core Engine & Lossless Feature Verification on sample-showcase.fig
// ============================================================================
const sampleFigPath = path.join(distDir, "sample-showcase.fig");
assert(fs.existsSync(sampleFigPath), "sample-showcase.fig must exist");
const sampleBytes = new Uint8Array(fs.readFileSync(sampleFigPath));
const sampleShaBefore = sha256File(sampleFigPath);

const summary = await workerEngine.handleWorkerRequest("loadBytes", {
  docId: "test_sample",
  bytes: sampleBytes,
  fileName: "sample-showcase.fig",
  sha256: sampleShaBefore
});

assert(summary.pageCount === 2, `Expected 2 pages, got ${summary.pageCount}`);
assert(summary.imageCount === 1, `Expected 1 embedded image, got ${summary.imageCount}`);
assert(summary.nodeCount >= 14, `Expected >= 14 nodes, got ${summary.nodeCount}`);

const framesPage1 = await workerEngine.handleWorkerRequest("frames", {
  docId: "test_sample",
  pageId: "0:1"
});
assert(framesPage1.total === 3, `Expected 3 frames on Page 1, got ${framesPage1.total}`);

const renderedMain = await workerEngine.handleWorkerRequest("render", {
  docId: "test_sample",
  nodeId: "1:100",
  includeRawSvg: true
});
assert(renderedMain.width === 1280 && renderedMain.height === 800, "Main frame dimensions must be 1280x800");
assert(renderedMain.svg.includes("99.42%"), "Single-level override text must render in SVG");
assert(renderedMain.svg.includes("87.5% (正常)"), "Multi-level nested guidPath override text must render in SVG");
assert(renderedMain.svg.includes("A4 4 0 0 1"), "Independent 4-corner radii arc path must render in SVG");
assert(renderedMain.hitBoxes.length >= 6, `Expected >= 6 interactive hitBoxes, got ${renderedMain.hitBoxes.length}`);

const ctaNode = await workerEngine.handleWorkerRequest("node", {
  docId: "test_sample",
  nodeId: "1:103"
});
assert(
  ctaNode.cssCode.includes("border-radius: 14px 4px 14px 4px;"),
  "Generated CSS must include independent 4-corner border-radius"
);

const assetsList = await workerEngine.handleWorkerRequest("listAssets", {
  docId: "test_sample"
});
assert(assetsList.total === 1, "Must list 1 embedded PNG asset");
const rawAsset = await workerEngine.handleWorkerRequest("getAssetData", {
  docId: "test_sample",
  hash: assetsList.items[0].hash
});
assert(rawAsset.width === 320 && rawAsset.height === 160 && rawAsset.ext === "png", "Asset header inspection must report 320x160 PNG");
const extractedBytes = Buffer.from(rawAsset.base64, "base64");
const extractedSha1 = crypto.createHash("sha1").update(extractedBytes).digest("hex");
assert(extractedSha1 === assetsList.items[0].hash, "Extracted image SHA-1 must 100% match original embedded asset");

const sampleShaAfter = sha256File(sampleFigPath);
assert(sampleShaBefore === sampleShaAfter, "sample-showcase.fig SHA-256 must remain untouched");

report.checks.coreEngine = {
  passed: true,
  sampleParseMs: summary.parseMs,
  sampleRenderMs: renderedMain.renderMs,
  hitBoxCount: renderedMain.hitBoxes.length,
  losslessAssetVerified: true
};

// ============================================================================
// 2. Optional Local Benchmark File Speed & Read-Only Integrity (via FIGFIG_BENCH_FILE)
// ============================================================================
const benchFigPath = process.env.FIGFIG_BENCH_FILE ? path.resolve(process.env.FIGFIG_BENCH_FILE) : "";

if (benchFigPath && fs.existsSync(benchFigPath)) {
  const statBefore = fs.statSync(benchFigPath);
  const shaBefore = sha256File(benchFigPath);
  const rawBenchBytes = new Uint8Array(fs.readFileSync(benchFigPath));

  const benchSummary = await workerEngine.handleWorkerRequest("loadBytes", {
    docId: "local_bench",
    bytes: rawBenchBytes,
    fileName: path.basename(benchFigPath),
    sha256: shaBefore
  });

  const benchPages = await workerEngine.handleWorkerRequest("pages", {
    docId: "local_bench",
    includeInternal: false
  });
  let sampleBoardRenderMs = 0;
  let sampleBoardVisited = 0;
  for (const p of benchPages) {
    const fList = await workerEngine.handleWorkerRequest("frames", {
      docId: "local_bench",
      pageId: p.id,
      limit: 5
    });
    if (fList.items.length > 0) {
      const r = await workerEngine.handleWorkerRequest("render", {
        docId: "local_bench",
        nodeId: fList.items[0].id
      });
      sampleBoardRenderMs = r.renderMs;
      sampleBoardVisited = r.visited;
      break;
    }
  }

  await workerEngine.handleWorkerRequest("closeDoc", { docId: "local_bench" });

  const statAfter = fs.statSync(benchFigPath);
  const shaAfter = sha256File(benchFigPath);
  assert(shaBefore === shaAfter, "Benchmark .fig SHA-256 must be 100% identical before and after");
  assert(statBefore.mtimeMs === statAfter.mtimeMs, "Benchmark .fig mtimeMs must be untouched");

  report.benchmarks.localFile = {
    byteLength: benchSummary.byteLength,
    nodeCount: benchSummary.nodeCount,
    imageCount: benchSummary.imageCount,
    visiblePages: benchPages.length,
    parseMs: benchSummary.parseMs,
    firstBoardRenderMs: sampleBoardRenderMs,
    firstBoardVisitedNodes: sampleBoardVisited,
    sha256Unchanged: shaBefore === shaAfter
  };
}

// ============================================================================
// 3. Native Desktop Executable (FigFig.exe) + WebView2 CDP Verification
// ============================================================================
const exePath = path.join(releaseDir, "FigFig.exe");
const zipPath = path.join(rootDir, "release", `FigFig-${version}-Windows-x64.zip`);
assert(fs.existsSync(exePath), `FigFig.exe must exist at ${exePath}`);
assert(fs.existsSync(zipPath), `Release ZIP must exist at ${zipPath}`);

const playwrightPath = path.join(workspaceRoot, ".venv", "Lib", "site-packages", "playwright", "driver", "package", "index.js");
let chromium = null;
try {
  const pw = requireCjs(playwrightPath);
  chromium = pw.chromium;
} catch {
  // fallback if playwright package is in node_modules
}

assert(chromium, "Playwright is required; a missing desktop test is not a PASS.");
if (chromium) {
  const debugPort = 19442;
  const tempProfile = path.join(verDir, "_temp_profile_" + Date.now());
  const readyFile = path.join(tempProfile, "ready.txt");
  const exportDir = path.join(tempProfile, "exports");
  fs.mkdirSync(exportDir, { recursive: true });

  const launchStart = performance.now();
  const child = spawn(
    exePath,
    [
      "--profile",
      tempProfile,
      "--debug-port",
      String(debugPort),
      "--ready-file",
      readyFile,
      "--export-dir",
      exportDir
    ],
    { stdio: "ignore", windowsHide: false }
  );
  let activePage;

  try {
    // Wait for readyFile
    const startWait = Date.now();
    while (!fs.existsSync(readyFile)) {
      if (Date.now() - startWait > 20000) {
        throw new Error("Timed out waiting for FigFig.exe WebView2 ready file");
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
    const context = browser.contexts()[0];
    const page = context.pages()[0];
    activePage = page;
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://figfig.local" });
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    context.on("weberror", (error) => browserErrors.push(error.error().message));

    const externalRequests = [];
    page.on("request", (req) => {
      const url = req.url();
      if (
        !url.startsWith("https://figfig.local/") &&
        !url.startsWith("https://figfig-files.local/") &&
        !url.startsWith("data:") &&
        !url.startsWith("blob:")
      ) {
        externalRequests.push(url);
      }
    });

    // Wait for initial sample-showcase.fig board to finish rendering
    await page.waitForFunction(() => document.body.dataset.ready === "true", null, {
      timeout: 30000
    });
    const startupMs = Math.round(performance.now() - launchStart);
    const originalPanels = await page.evaluate(() => ({ left: document.querySelector(".sidebar").getBoundingClientRect().width, right: document.querySelector(".inspector").getBoundingClientRect().width }));
    for (const [id, delta] of [["resize-sidebar", 40], ["resize-inspector", -30]]) {
      const handle = await page.locator(`#${id}`).boundingBox();
      if (!handle) continue;
      const previous = Number(await page.locator(`#${id}`).getAttribute("aria-valuenow"));
      await page.mouse.move(handle.x + handle.width / 2, handle.y + 60);
      await page.mouse.down();
      await page.mouse.move(handle.x + handle.width / 2 + delta, handle.y + 60, { steps: 5 });
      await page.mouse.up();
      const current = Number(await page.locator(`#${id}`).getAttribute("aria-valuenow"));
      assert(current !== previous, `${id} must change actual native panel width.`);
      await page.locator(`#${id}`).dblclick({ position: { x: 3, y: 60 } });
    }
    report.checks.nativeResizablePanels = { passed: true, originalPanels, startupMs };

    // Verify tall 1440x1204 frame (1:300) anti-jitter stability across 20 animation frames
    await page.evaluate(() => window.__figfigApp.selectNodeAndRender("1:300", true));
    const stability = await page.evaluate(async () => {
      const samples = [];
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        const wrap = document.getElementById("board-wrap").getBoundingClientRect();
        const vp = document.getElementById("viewport");
        samples.push({
          scale: window.__figfigApp.getActiveTab().scale,
          w: Math.round(wrap.width),
          h: Math.round(wrap.height),
          vpClientW: vp.clientWidth,
          vpClientH: vp.clientHeight,
          fittedClass: vp.classList.contains("is-fitted")
        });
      }
      const first = samples[0];
      const jitterCount = samples.filter(
        (s) => s.scale !== first.scale || s.w !== first.w || s.h !== first.h || s.vpClientW !== first.vpClientW || s.vpClientH !== first.vpClientH
      ).length;
      return { jitterCount, first };
    });
    assert(stability.jitterCount === 0 && stability.first.fittedClass === true, "Tall frame (1440x1204) must remain 100% stable with zero ResizeObserver jitter.");
    report.checks.tallFrameStability = { passed: true, ...stability.first };

    // Switch back to main frame 1:100 and click CTA text on hit-overlay
    await page.evaluate(() => window.__figfigApp.selectNodeAndRender("1:100", true));
    const overlayBox = await page.locator("#hit-overlay").boundingBox();
    assert(overlayBox && overlayBox.width > 100, "Hit overlay must be visible and sized");
    const clickX = overlayBox.x + (1120 / 1280) * overlayBox.width;
    const clickY = overlayBox.y + (48 / 800) * overlayBox.height;
    await page.mouse.click(clickX, clickY);

    await page.waitForFunction(
      () => {
        const text = document.getElementById("inspector-body")?.textContent || "";
        return text.includes("BtnPrimaryAction") || text.includes("BtnExecuteLabel");
      },
      null,
      { timeout: 5000 }
    );

    // Test native clipboard copy (Text, CSS, JSON)
    await page.evaluate(() => window.__figfigApp.selectNodeAndRender("1:104", false));
    await page.click("#btn-copy-text");
    await page.waitForFunction(() => document.getElementById("status-text").textContent === "已复制节点文本");
    assert(await page.evaluate(() => navigator.clipboard.readText()) === "一键生成诊断报告", "Copied text must match the selected node text.");
    await page.click("#btn-copy-css");
    await page.waitForFunction(() => document.getElementById("status-text").textContent === "已复制节点 CSS 代码");
    const copiedCss = await page.evaluate(() => navigator.clipboard.readText());
    assert(copiedCss.includes("width:") && copiedCss.includes("height:"), "Copied CSS must contain selected-node dimensions.");
    await page.click("#btn-copy-json");
    await page.waitForFunction(() => document.getElementById("status-text").textContent === "已复制节点 JSON 数据");
    const copiedNode = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
    assert(copiedNode.id === "1:104" && copiedNode.type === "TEXT", "Copied JSON must be the selected node.");
    report.checks.clipboard = { passed: true, cssCharacters: copiedCss.length, jsonNodeId: copiedNode.id };

    // Export SVG, 2x PNG & Original-size HTML via host exportDir
    await page.click("#btn-export-svg");
    await page.waitForFunction(() => document.getElementById("status-text").textContent.startsWith("已导出") && document.getElementById("status-text").textContent.includes(".svg"));
    await page.click("#btn-export-png");
    await page.waitForFunction(() => document.getElementById("status-text").textContent.startsWith("已导出 PNG"));
    await page.click("#btn-export-html");
    await page.waitForFunction(() => document.getElementById("status-text").textContent.startsWith("已导出原尺寸 HTML"));
    const nativeHtmlName = fs.readdirSync(exportDir).find((name) => name.endsWith(".html"));
    assert(nativeHtmlName, "Native HTML save must create a real file.");
    const nativeHtml = fs.readFileSync(path.join(exportDir, nativeHtmlName), "utf8");
    const nativeBoard = await page.evaluate(() => { const tab = window.__figfigApp.getActiveTab(); return { width: tab.nativeWidth, height: tab.nativeHeight }; });
    assert(nativeHtml.includes(`width="${nativeBoard.width}" height="${nativeBoard.height}"`) && nativeHtml.includes("data:image/svg+xml;base64,"), "Native HTML must embed the original-size vector preview.");
    const nativePngName = fs.readdirSync(exportDir).find((name) => name.endsWith(".png"));
    const nativePng = fs.readFileSync(path.join(exportDir, nativePngName));
    assert(nativePng.readUInt32BE(16) === nativeBoard.width * 2 && nativePng.readUInt32BE(20) === nativeBoard.height * 2, "Native PNG must preserve the requested 2x dimensions.");
    report.checks.nativeExports = { passed: true, png: { width: nativePng.readUInt32BE(16), height: nativePng.readUInt32BE(20) }, html: nativeBoard };

    // Switch to Gallery Overview mode and back to Canvas mode
    await page.click("#mode-gallery");
    await page.waitForSelector(".gallery-card", { timeout: 8000 });
    await page.click("#mode-canvas");

    // Switch to Assets tab, preview an asset (verifying SVG/HTML export disables), and extract lossless original
    await page.click("#tab-assets");
    await page.waitForSelector(".asset-card", { timeout: 5000 });
    await page.locator(".asset-card button").first().click(); // Preview asset
    await page.waitForFunction(() => document.getElementById("btn-export-svg")?.disabled === true, null, { timeout: 5000 });
    assert(await page.locator("#btn-export-html").isDisabled(), "Raw asset preview must not export a previous frame as HTML.");
    await page.locator(".asset-card button").nth(1).click(); // Lossless extract asset
    await new Promise((r) => setTimeout(r, 300));

    // Test Theme Cycling (Light -> Sepia -> Dark) & Windmill Icon Adaptation
    await page.click("#btn-theme"); // -> sepia
    assert((await page.evaluate(() => document.documentElement.getAttribute("data-theme"))) === "sepia", "Theme must cycle to sepia");
    await page.click("#btn-theme"); // -> dark
    assert((await page.evaluate(() => document.documentElement.getAttribute("data-theme"))) === "dark", "Theme must cycle to dark");
    assert((await page.locator("#brand-logo-img").getAttribute("src")) === "figfig-dark.svg", "Dark theme must use dark-adapted windmill icon");
    await page.click("#btn-theme"); // -> light
    assert((await page.evaluate(() => document.documentElement.getAttribute("data-theme"))) === "light", "Theme must cycle back to light");

    // Open MCP Protocol Dialog & verify config snippet
    await page.click("#btn-mcp");
    await page.waitForSelector("#dialog-mcp[open]", { timeout: 5000 });
    const mcpSnippet = await page.locator("#mcp-vscode-code").textContent();
    assert(mcpSnippet.includes("figfig-design"), "MCP dialog must show figfig-design server configuration");
    await page.click("#btn-close-mcp");

    // Open Shortcuts Help Dialog
    await page.click("#btn-help");
    await page.waitForSelector("#dialog-help[open]", { timeout: 5000 });
    await page.click("#btn-close-help");

    // Open SHA-256 Integrity Dialog
    await page.click("#btn-integrity");
    await page.waitForSelector("#dialog-report[open]", { timeout: 5000 });
    await page.click("#btn-close-report");

    const exportedFiles = fs.readdirSync(exportDir);
    assert(
      exportedFiles.some((f) => f.endsWith(".svg")),
      "Desktop SVG export must write .svg file"
    );
    assert(
      exportedFiles.some((f) => f.endsWith(".png")),
      "Desktop PNG export must write .png file"
    );
    assert(exportedFiles.some((name) => name.endsWith(".html")), "Desktop HTML export must write .html file");
    while (await page.locator(".tab-close").count()) {
      const count = await page.locator(".tab-close").count();
      await page.locator(".tab-close").last().click();
      await page.waitForFunction((previous) => document.querySelectorAll(".tab-close").length < previous, count);
    }
    for (const id of ["btn-export-svg", "btn-export-png", "btn-export-html", "btn-copy-css", "btn-copy-text", "btn-copy-json"]) assert(await page.locator(`#${id}`).isDisabled(), `Empty workspace must disable ${id}.`);
    report.checks.closeAllTabs = { passed: true };
    assert(externalRequests.length === 0, "Zero external network requests allowed");
    assert(browserErrors.length === 0, "Browser runtime errors: " + browserErrors.join("; "));

    await browser.close();

    report.checks.desktopApp = {
      passed: true,
      exportedFiles,
      externalRequestsCount: externalRequests.length
    };
  } catch (error) {
    report.checks.desktopApp = { passed: false, error: error.message };
    if (activePage && !activePage.isClosed()) {
      report.checks.desktopApp.context = await activePage.evaluate(() => ({
        status: document.getElementById("status-text")?.textContent,
        selectedText: document.querySelector(".text-preview-box")?.textContent,
        selectedNodeId: window.__figfigApp?.getActiveTab()?.selectedNodeId,
      })).catch(() => null);
    }
    console.error(JSON.stringify(report.checks.desktopApp, null, 2));
    throw error;
  } finally {
    try {
      child.kill();
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
    try {
      fs.rmSync(verDir, { recursive: true, force: true });
    } catch {}
  }
}

report.artifacts = {
  exePath,
  exeSha256: sha256File(exePath),
  zipPath,
  zipSha256: sha256File(zipPath),
  zipBytes: fs.statSync(zipPath).size
};

// ============================================================================
// 4. End-to-End MCP Protocol (stdio JSON-RPC 2.0) Verification
// ============================================================================
async function verifyMcpServer() {
  const mcpServerPath = path.join(releaseDir, "mcp", "server.mjs");
  assert(fs.existsSync(mcpServerPath), `Packaged MCP server must exist at ${mcpServerPath}`);

  const mcpChild = spawn(process.execPath, [mcpServerPath], {
    stdio: ["pipe", "pipe", "pipe"]
  });

  let stdoutBuf = "";
  const pendingRpc = new Map();
  mcpChild.stdout.on("data", (chunk) => {
    stdoutBuf += chunk.toString("utf8");
    let nl;
    while ((nl = stdoutBuf.indexOf("\n")) >= 0) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pendingRpc.has(msg.id)) {
        const { resolve } = pendingRpc.get(msg.id);
        pendingRpc.delete(msg.id);
        resolve(msg);
      }
    }
  });

  let seq = 0;
  function callMcp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => {
        pendingRpc.delete(id);
        reject(new Error(`MCP RPC timeout: ${method}`));
      }, 20000);
      pendingRpc.set(id, {
        resolve: (res) => {
          clearTimeout(timer);
          resolve(res);
        }
      });
      mcpChild.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  try {
    const initRes = await callMcp("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "vscode-verify-client", version: "1.0.0" }
    });
    assert(initRes.result?.serverInfo?.name === "figfig-mcp-server", "MCP initialize must return figfig-mcp-server");

    const toolsRes = await callMcp("tools/list", {});
    const toolNames = (toolsRes.result?.tools || []).map((t) => t.name);
    assert(toolNames.length === 7, `Expected 7 MCP tools, got ${toolNames.length}`);

    const listFilesRes = await callMcp("tools/call", {
      name: "figfig_list_local_files",
      arguments: {}
    });
    const listFilesData = JSON.parse(listFilesRes.result.content[0].text);
    assert(listFilesData.total >= 1, "MCP figfig_list_local_files must discover local .fig files");

    const targetFig = benchFigPath && fs.existsSync(benchFigPath) ? benchFigPath : sampleFigPath;
    const targetShaBefore = sha256File(targetFig);

    const pagesRes = await callMcp("tools/call", {
      name: "figfig_list_pages",
      arguments: { filePath: targetFig }
    });
    const pagesData = JSON.parse(pagesRes.result.content[0].text);
    assert(pagesData.file.sha256 === targetShaBefore, "MCP figfig_list_pages must return exact SHA-256");
    assert(pagesData.pages.length >= 1, "MCP figfig_list_pages must list visible pages");

    const firstPageId = pagesData.pages[0].id;
    const framesRes = await callMcp("tools/call", {
      name: "figfig_get_frames",
      arguments: { filePath: targetFig, pageId: firstPageId, limit: 10 }
    });
    const framesData = JSON.parse(framesRes.result.content[0].text);
    assert(framesData.items.length >= 1, "MCP figfig_get_frames must return frames");

    const searchRes = await callMcp("tools/call", {
      name: "figfig_search",
      arguments: { filePath: targetFig, query: "SLA", limit: 10 }
    });
    const searchData = JSON.parse(searchRes.result.content[0].text);
    assert(searchData.total >= 1, "MCP figfig_search must find matching nodes");

    const targetFrameId = framesData.items[0].id;
    const nodeRes = await callMcp("tools/call", {
      name: "figfig_read_node",
      arguments: { filePath: targetFig, nodeId: targetFrameId }
    });
    const nodeData = JSON.parse(nodeRes.result.content[0].text);
    assert(nodeData.id === targetFrameId && nodeData.cssCode.includes("width:"), "MCP figfig_read_node must return node details and CSS");

    const renderRes = await callMcp("tools/call", {
      name: "figfig_render_frame",
      arguments: { filePath: targetFig, nodeId: targetFrameId, format: "both", maxDimension: 1200 }
    });
    const renderContents = renderRes.result.content;
    const imagePart = renderContents.find((c) => c.type === "image" && c.mimeType === "image/png");
    assert(imagePart && imagePart.data.length > 500, "MCP figfig_render_frame must return non-empty base64 PNG image");

    const compatRes = await callMcp("tools/call", {
      name: "figfig_compatibility",
      arguments: { filePath: targetFig }
    });
    const compatData = JSON.parse(compatRes.result.content[0].text);
    assert(compatData.readOnly === true && compatData.sha256 === targetShaBefore, "MCP figfig_compatibility must confirm read-only integrity");

    // Verify path security guard rejects non-.fig files
    const badPathRes = await callMcp("tools/call", {
      name: "figfig_list_pages",
      arguments: { filePath: path.join(rootDir, "package.json") }
    });
    assert(badPathRes.error && badPathRes.error.message.includes(".fig"), "MCP must reject non-.fig files");

    assert(sha256File(targetFig) === targetShaBefore, "Target .fig file must remain byte-identical after all MCP tool calls");

    report.checks.mcpServer = {
      passed: true,
      protocolVersion: initRes.result.protocolVersion,
      toolsVerified: toolNames,
      renderedPngBytes: Buffer.from(imagePart.data, "base64").length
    };
  } finally {
    try {
      mcpChild.kill();
    } catch {}
  }
}

await verifyMcpServer();

console.log("FIGFIG_VERIFY_ALL_PASS", JSON.stringify(report, null, 2));
