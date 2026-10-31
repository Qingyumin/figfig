using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Web;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: System.Reflection.AssemblyTitle("FigFig - Figma Viewer")]
[assembly: System.Reflection.AssemblyProduct("FigFig")]
[assembly: System.Reflection.AssemblyDescription("Local read-only Figma viewer with compatible rendering and MCP")]
[assembly: System.Reflection.AssemblyVersion("1.2.0.0")]
[assembly: System.Reflection.AssemblyFileVersion("1.2.0.0")]

namespace FigFig
{
    internal static class Program
    {
        [DllImport("shcore.dll")]
        private static extern int SetProcessDpiAwareness(int awareness);

        [STAThread]
        private static void Main(string[] args)
        {
            try { SetProcessDpiAwareness(2); } catch { }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new FigFigWindow(args));
        }
    }

    public sealed class FigFigWindow : Form
    {
        private readonly WebView2 browser = new WebView2();
        private readonly JavaScriptSerializer serializer = new JavaScriptSerializer { MaxJsonLength = 64 * 1024 * 1024, RecursionLimit = 64 };
        private readonly FigFigStore store;
        private readonly string profileDir;
        private readonly string initialOpenPath;
        private readonly string readyFile;
        private readonly string exportDir;
        private readonly int debugPort;

        [DllImport("user32.dll")]
        private static extern uint GetDpiForSystem();

        public FigFigWindow(string[] args)
        {
            profileDir = GetArg(args, "--profile") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FigFig", "V1");
            profileDir = Path.GetFullPath(profileDir);
            initialOpenPath = GetArg(args, "--open") ?? FindPositionalFigArg(args);
            readyFile = GetArg(args, "--ready-file");
            exportDir = GetArg(args, "--export-dir");
            Int32.TryParse(GetArg(args, "--debug-port"), out debugPort);
            if (debugPort < 1024 || debugPort > 65535) debugPort = 0;

            store = new FigFigStore(profileDir);

            Text = "FigFig 1.2.0 - Figma Viewer";
            double dpiScale = 1.0;
            try { dpiScale = Math.Max(1.0, GetDpiForSystem() / 96.0); } catch { }
            var screen = Screen.PrimaryScreen.WorkingArea;
            int targetW = Math.Min((int)(1440 * dpiScale), screen.Width - 40);
            int targetH = Math.Min((int)(900 * dpiScale), screen.Height - 40);
            ClientSize = new Size(Math.Max(960, targetW), Math.Max(640, targetH));
            MinimumSize = new Size(760, 520);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(236, 244, 240);

            string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "FigFig.ico");
            if (File.Exists(iconPath))
            {
                try { Icon = new Icon(iconPath); } catch { }
            }

            AllowDrop = true;
            DragEnter += OnWindowDragEnter;
            DragDrop += OnWindowDragDrop;

            browser.Dock = DockStyle.Fill;
            browser.DefaultBackgroundColor = BackColor;
            Controls.Add(browser);

            Shown += async delegate { await InitializeWebView(); };
        }

        private static string GetArg(string[] args, string key)
        {
            for (int i = 0; i < args.Length - 1; i++)
            {
                if (String.Equals(args[i], key, StringComparison.OrdinalIgnoreCase)) return args[i + 1];
            }
            return null;
        }

        private static string FindPositionalFigArg(string[] args)
        {
            foreach (var arg in args)
            {
                if (String.IsNullOrWhiteSpace(arg) || arg.StartsWith("--", StringComparison.Ordinal)) continue;
                try
                {
                    var ext = Path.GetExtension(arg).ToLowerInvariant();
                    if ((ext == ".fig" || ext == ".deck") && File.Exists(arg)) return Path.GetFullPath(arg);
                }
                catch { }
            }
            return null;
        }

        private void OnWindowDragEnter(object sender, DragEventArgs e)
        {
            if (e.Data.GetDataPresent(DataFormats.FileDrop)) e.Effect = DragDropEffects.Copy;
        }

        private void OnWindowDragDrop(object sender, DragEventArgs e)
        {
            try
            {
                var files = e.Data.GetData(DataFormats.FileDrop) as string[];
                if (files != null && files.Length > 0)
                {
                    var session = store.RegisterReadOnlyFile(files[0]);
                    SendEvent("openFileFromHost", SerializeSession(session));
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, ex.Message, "FigFig", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private async System.Threading.Tasks.Task InitializeWebView()
        {
            try
            {
                Directory.CreateDirectory(profileDir);
                var options = new CoreWebView2EnvironmentOptions();
                if (debugPort != 0)
                {
                    options.AdditionalBrowserArguments = "--remote-debugging-port=" + debugPort + " --remote-debugging-address=127.0.0.1";
                }
                var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(profileDir, "webview"), options);
                await browser.EnsureCoreWebView2Async(env);

                var settings = browser.CoreWebView2.Settings;
                settings.AreDevToolsEnabled = debugPort != 0;
                settings.AreDefaultContextMenusEnabled = false;
                settings.IsStatusBarEnabled = false;
                settings.IsZoomControlEnabled = false;
                settings.AreHostObjectsAllowed = false;
                settings.IsPasswordAutosaveEnabled = false;
                settings.IsGeneralAutofillEnabled = false;

                string appFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app");
                browser.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "figfig.local",
                    appFolder,
                    CoreWebView2HostResourceAccessKind.DenyCors
                );

                browser.CoreWebView2.PermissionRequested += delegate(object s, CoreWebView2PermissionRequestedEventArgs e)
                {
                    e.State = CoreWebView2PermissionState.Deny;
                };
                browser.CoreWebView2.NewWindowRequested += delegate(object s, CoreWebView2NewWindowRequestedEventArgs e)
                {
                    e.Handled = true;
                };
                browser.CoreWebView2.NavigationStarting += delegate(object s, CoreWebView2NavigationStartingEventArgs e)
                {
                    if (!e.Uri.StartsWith("https://figfig.local/", StringComparison.OrdinalIgnoreCase))
                    {
                        e.Cancel = true;
                    }
                };

                browser.CoreWebView2.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All, CoreWebView2WebResourceRequestSourceKinds.All);
                browser.CoreWebView2.WebResourceRequested += OnWebResourceRequested;
                browser.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
                browser.CoreWebView2.NavigationCompleted += delegate(object s, CoreWebView2NavigationCompletedEventArgs e)
                {
                    if (e.IsSuccess && !String.IsNullOrEmpty(readyFile))
                    {
                        try { File.WriteAllText(Path.GetFullPath(readyFile), "ready", Encoding.UTF8); } catch { }
                    }
                };

                browser.CoreWebView2.Navigate("https://figfig.local/index.html");
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    this,
                    "无法启动 FigFig 桌面端。请确认系统已安装 Microsoft Edge WebView2 Runtime。\n\n" + ex.Message,
                    "FigFig",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                Close();
            }
        }

        private void OnWebResourceRequested(object sender, CoreWebView2WebResourceRequestedEventArgs e)
        {
            var uriStr = e.Request.Uri ?? "";
            if (uriStr.StartsWith("https://figfig.local/", StringComparison.OrdinalIgnoreCase) ||
                uriStr.StartsWith("data:", StringComparison.OrdinalIgnoreCase) ||
                uriStr.StartsWith("blob:", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (uriStr.StartsWith("https://figfig-files.local/doc", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    var uri = new Uri(uriStr);
                    var query = HttpUtility.ParseQueryString(uri.Query);
                    string token = query["token"];
                    var stream = store.OpenReadStream(token);
                    if (stream != null)
                    {
                        string headers = "Content-Type: application/octet-stream\r\nAccess-Control-Allow-Origin: https://figfig.local\r\nCache-Control: no-store";
                        e.Response = browser.CoreWebView2.Environment.CreateWebResourceResponse(stream, 200, "OK", headers);
                        return;
                    }
                }
                catch { }
                e.Response = browser.CoreWebView2.Environment.CreateWebResourceResponse(new MemoryStream(new byte[0]), 404, "Not Found", "Content-Type: text/plain\r\nAccess-Control-Allow-Origin: *");
                return;
            }

            // Strictly block all external network requests (100% offline zero-upload guarantee)
            e.Response = browser.CoreWebView2.Environment.CreateWebResourceResponse(
                new MemoryStream(new byte[0]),
                403,
                "Offline Policy",
                "Content-Type: text/plain"
            );
        }

        private static object SerializeSession(ReadOnlyFigSession s)
        {
            if (s == null) return null;
            return new
            {
                token = s.Token,
                name = s.Name,
                path = s.Path,
                byteLength = s.ByteLength,
                sha256 = s.Sha256,
                streamUrl = s.StreamUrl
            };
        }

        private static string GetValue(Dictionary<string, object> dict, string key)
        {
            object val;
            return dict != null && dict.TryGetValue(key, out val) && val != null ? Convert.ToString(val) : null;
        }

        private void SendEvent(string eventName, object payload)
        {
            if (IsDisposed || browser.CoreWebView2 == null) return;
            browser.CoreWebView2.PostWebMessageAsJson(serializer.Serialize(new { @event = eventName, payload }));
        }

        private void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            if (!e.Source.StartsWith("https://figfig.local/", StringComparison.OrdinalIgnoreCase)) return;
            string id = null;
            try
            {
                var msg = serializer.DeserializeObject(e.WebMessageAsJson) as Dictionary<string, object>;
                if (msg == null) return;
                id = GetValue(msg, "id");
                string kind = GetValue(msg, "kind");
                var payload = msg.ContainsKey("payload") ? msg["payload"] as Dictionary<string, object> : new Dictionary<string, object>();
                object result = null;

                if (kind == "init")
                {
                    object initialDoc = null;
                    if (!String.IsNullOrEmpty(initialOpenPath) && File.Exists(initialOpenPath))
                    {
                        initialDoc = SerializeSession(store.RegisterReadOnlyFile(initialOpenPath));
                    }
                    result = new { initialDoc };
                }
                else if (kind == "setTitle")
                {
                    string title = GetValue(payload, "title");
                    if (!String.IsNullOrWhiteSpace(title)) Text = title;
                    result = true;
                }
                else if (kind == "copyText")
                {
                    string text = GetValue(payload, "text") ?? String.Empty;
                    string requestId = id;
                    BeginInvoke(new Action(delegate
                    {
                        if (IsDisposed || browser.CoreWebView2 == null) return;
                        try
                        {
                            if (text.Length == 0) Clipboard.Clear();
                            else Clipboard.SetText(text, TextDataFormat.UnicodeText);
                            browser.CoreWebView2.PostWebMessageAsJson(serializer.Serialize(new { id = requestId, ok = true, value = new { copied = true, characters = text.Length } }));
                        }
                        catch (Exception error)
                        {
                            browser.CoreWebView2.PostWebMessageAsJson(serializer.Serialize(new { id = requestId, ok = false, error = error.Message }));
                        }
                    }));
                    return;
                }
                else if (kind == "setTheme")
                {
                    string theme = GetValue(payload, "theme") ?? "light";
                    string icoName = String.Equals(theme, "dark", StringComparison.OrdinalIgnoreCase)
                        ? "FigFig-dark.ico"
                        : "FigFig-light.ico";
                    string icoPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, icoName);
                    if (!File.Exists(icoPath)) icoPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "FigFig.ico");
                    if (File.Exists(icoPath))
                    {
                        try { Icon = new Icon(icoPath); } catch { }
                    }
                    result = new { theme, icon = Path.GetFileName(icoPath) };
                }
                else if (kind == "getMcpConfig")
                {
                    string mcpServerPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "mcp", "server.mjs").Replace('\\', '/');
                    var mcpObj = new
                    {
                        servers = new Dictionary<string, object>
                        {
                            {
                                "figfig-design",
                                new
                                {
                                    type = "stdio",
                                    command = "node",
                                    args = new[] { mcpServerPath }
                                }
                            }
                        }
                    };
                    result = new { vscodeMcpJson = serializer.Serialize(mcpObj), serverPath = mcpServerPath };
                }
                else if (kind == "openDialog")
                {
                    using (var dialog = new OpenFileDialog
                    {
                            Title = "打开本地 Figma (.fig / .deck) 文件（只读）",
                        Filter = "Figma 设计文件 (*.fig;*.deck)|*.fig;*.deck",
                        CheckFileExists = true,
                        Multiselect = false
                    })
                    {
                        if (dialog.ShowDialog(this) == DialogResult.OK)
                        {
                            result = SerializeSession(store.RegisterReadOnlyFile(dialog.FileName));
                        }
                    }
                }
                else if (kind == "openPath")
                {
                    string path = GetValue(payload, "path");
                    if (!String.IsNullOrEmpty(path))
                    {
                        result = SerializeSession(store.RegisterReadOnlyFile(path));
                    }
                }
                else if (kind == "getQuickFiles")
                {
                    var list = new List<object>();
                    foreach (var item in store.GetQuickFiles())
                    {
                        list.Add(new
                        {
                            name = item.Name,
                            path = item.Path,
                            byteLength = item.ByteLength,
                            source = item.Source
                        });
                    }
                    result = list;
                }
                else if (kind == "saveFile")
                {
                    string fileName = Path.GetFileName(GetValue(payload, "fileName") ?? "export.svg");
                    string base64 = GetValue(payload, "base64");
                    string filter = GetValue(payload, "filter") ?? "All files|*.*";
                    if (!String.IsNullOrEmpty(exportDir))
                    {
                        string target = Path.Combine(Path.GetFullPath(exportDir), fileName);
                        FigFigStore.SaveExportedBytes(target, base64);
                        result = new { name = fileName, path = target };
                    }
                    else
                    {
                        using (var dialog = new SaveFileDialog
                        {
                            Title = "导出文件",
                            Filter = filter,
                            FileName = fileName,
                            OverwritePrompt = true
                        })
                        {
                            if (dialog.ShowDialog(this) == DialogResult.OK)
                            {
                                FigFigStore.SaveExportedBytes(dialog.FileName, base64);
                                result = new { name = Path.GetFileName(dialog.FileName), path = dialog.FileName };
                            }
                        }
                    }
                }
                else
                {
                    throw new InvalidOperationException("Unsupported host operation: " + kind);
                }

                if (!IsDisposed && browser.CoreWebView2 != null)
                {
                    browser.CoreWebView2.PostWebMessageAsJson(serializer.Serialize(new { id, ok = true, value = result }));
                }
            }
            catch (Exception ex)
            {
                if (!IsDisposed && browser.CoreWebView2 != null)
                {
                    browser.CoreWebView2.PostWebMessageAsJson(serializer.Serialize(new { id, ok = false, error = ex.Message }));
                }
            }
        }
    }
}
