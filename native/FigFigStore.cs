using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

namespace FigFig
{
    public sealed class ReadOnlyFigSession
    {
        public string Token { get; set; }
        public string Name { get; set; }
        public string Path { get; set; }
        public long ByteLength { get; set; }
        public string Sha256 { get; set; }
        public string StreamUrl { get; set; }
    }

    public sealed class QuickFileEntry
    {
        public string Name { get; set; }
        public string Path { get; set; }
        public long ByteLength { get; set; }
        public string Source { get; set; }
    }

    public sealed class FigFigStore
    {
        public const long MaxFileBytes = 256L * 1024L * 1024L;
        private readonly string profileDir;
        private readonly string recentPath;
        private readonly Dictionary<string, ReadOnlyFigSession> sessions = new Dictionary<string, ReadOnlyFigSession>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, string> pathToToken = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private readonly List<string> recentFiles = new List<string>();
        private readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 32 * 1024 * 1024 };

        public FigFigStore(string profileDirectory)
        {
            if (String.IsNullOrWhiteSpace(profileDirectory)) throw new ArgumentException("Profile directory is required.");
            profileDir = Path.GetFullPath(profileDirectory);
            Directory.CreateDirectory(profileDir);
            recentPath = Path.Combine(profileDir, "recent.json");
            LoadRecent();
        }

        private void LoadRecent()
        {
            if (!File.Exists(recentPath)) return;
            try
            {
                var items = json.Deserialize<List<string>>(File.ReadAllText(recentPath, Encoding.UTF8));
                if (items != null)
                {
                    foreach (var item in items)
                    {
                        if (!String.IsNullOrWhiteSpace(item) && File.Exists(item)) recentFiles.Add(item);
                    }
                }
            }
            catch { }
        }

        private void SaveRecent()
        {
            try
            {
                File.WriteAllText(recentPath, json.Serialize(recentFiles), Encoding.UTF8);
            }
            catch { }
        }

        public static string ComputeSha256ReadOnly(string fullPath)
        {
            using (var stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite, 65536))
            using (var sha = SHA256.Create())
            {
                var hash = sha.ComputeHash(stream);
                var sb = new StringBuilder(hash.Length * 2);
                for (int i = 0; i < hash.Length; i++) sb.Append(hash[i].ToString("x2"));
                return sb.ToString();
            }
        }

        public ReadOnlyFigSession RegisterReadOnlyFile(string filePath)
        {
            if (String.IsNullOrWhiteSpace(filePath)) throw new ArgumentException("请选择有效的本地 .fig 文件。");
            var fullPath = Path.GetFullPath(filePath);
            var ext = Path.GetExtension(fullPath).ToLowerInvariant();
            if (ext != ".fig" && ext != ".deck")
            {
                throw new InvalidOperationException("仅支持打开 .fig 或 .deck 格式的设计文件。");
            }
            var info = new FileInfo(fullPath);
            if (!info.Exists) throw new FileNotFoundException("未找到指定的 .fig 文件。", fullPath);
            if (info.Length < 16 || info.Length > MaxFileBytes)
            {
                throw new InvalidOperationException("文件大小超出安全范围 (16B ~ 256MB)。");
            }

            // Verify header magic in strict read-only shared mode
            using (var stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
            {
                var header = new byte[8];
                int read = stream.Read(header, 0, 8);
                if (read < 8) throw new InvalidOperationException("文件头部已损坏。");
                bool isZip = header[0] == 0x50 && header[1] == 0x4B;
                string ascii = Encoding.ASCII.GetString(header, 0, 4);
                if (!isZip && ascii != "fig-")
                {
                    throw new InvalidOperationException("文件头签名不是有效的 Figma (.fig / fig-kiwi) 格式。");
                }
            }

            string sha256 = ComputeSha256ReadOnly(fullPath);
            string token;
            if (!pathToToken.TryGetValue(fullPath, out token))
            {
                token = Guid.NewGuid().ToString("N");
                pathToToken[fullPath] = token;
            }

            var session = new ReadOnlyFigSession
            {
                Token = token,
                Name = Path.GetFileName(fullPath),
                Path = fullPath,
                ByteLength = info.Length,
                Sha256 = sha256,
                StreamUrl = "https://figfig-files.local/doc?token=" + token
            };
            sessions[token] = session;

            recentFiles.RemoveAll(p => String.Equals(p, fullPath, StringComparison.OrdinalIgnoreCase));
            recentFiles.Insert(0, fullPath);
            if (recentFiles.Count > 15) recentFiles.RemoveRange(15, recentFiles.Count - 15);
            SaveRecent();

            return session;
        }

        public Stream OpenReadStream(string token)
        {
            if (String.IsNullOrWhiteSpace(token)) return null;
            ReadOnlyFigSession session;
            if (!sessions.TryGetValue(token, out session)) return null;
            if (!File.Exists(session.Path)) return null;
            return new FileStream(session.Path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite, 65536);
        }

        public List<QuickFileEntry> GetQuickFiles()
        {
            var result = new List<QuickFileEntry>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var path in recentFiles)
            {
                try
                {
                    var info = new FileInfo(path);
                    if (info.Exists && (info.Extension.Equals(".fig", StringComparison.OrdinalIgnoreCase) || info.Extension.Equals(".deck", StringComparison.OrdinalIgnoreCase)))
                    {
                        if (seen.Add(info.FullName))
                        {
                            result.Add(new QuickFileEntry { Name = info.Name, Path = info.FullName, ByteLength = info.Length, Source = "recent" });
                        }
                    }
                }
                catch { }
            }

            var folders = new List<string>();
            try
            {
                var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                if (!String.IsNullOrEmpty(userProfile))
                {
                    folders.Add(Path.Combine(userProfile, "Downloads"));
                    folders.Add(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
                }
            }
            catch { }

            foreach (var folder in folders)
            {
                if (String.IsNullOrEmpty(folder) || !Directory.Exists(folder)) continue;
                try
                {
                    foreach (var file in Directory.GetFiles(folder, "*.fig", SearchOption.TopDirectoryOnly))
                    {
                        var info = new FileInfo(file);
                        if (info.Exists && info.Length >= 16 && seen.Add(info.FullName))
                        {
                            result.Add(new QuickFileEntry { Name = info.Name, Path = info.FullName, ByteLength = info.Length, Source = "local" });
                            if (result.Count >= 20) return result;
                        }
                    }
                }
                catch { }
            }

            return result;
        }

        public static void SaveExportedBytes(string targetPath, string base64Data)
        {
            if (String.IsNullOrWhiteSpace(targetPath)) throw new ArgumentException("导出路径不能为空。");
            var full = Path.GetFullPath(targetPath);
            var ext = Path.GetExtension(full).ToLowerInvariant();
            if (ext == ".fig" || ext == ".deck")
            {
                throw new InvalidOperationException("只读无损保护：禁止覆盖或写入 .fig / .deck 源文件！");
            }
            var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".svg", ".png", ".jpg", ".jpeg", ".webp", ".json", ".css", ".txt", ".html" };
            if (!allowed.Contains(ext))
            {
                throw new InvalidOperationException("仅允许导出为 SVG、PNG、JPG、WEBP、HTML、JSON、CSS 或 TXT 格式。");
            }
            var bytes = Convert.FromBase64String(base64Data ?? "");
            var dir = Path.GetDirectoryName(full);
            if (!String.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            File.WriteAllBytes(full, bytes);
        }
    }
}
