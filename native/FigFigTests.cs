using System;
using System.IO;
using System.Text;

namespace FigFig
{
    internal static class FigFigTests
    {
        private static void Assert(bool condition, string message)
        {
            if (!condition) throw new InvalidOperationException("ASSERTION FAILED: " + message);
        }

        private static int Main()
        {
            string tempRoot = Path.Combine(Path.GetTempPath(), "FigFigTests_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempRoot);
            try
            {
                var store = new FigFigStore(Path.Combine(tempRoot, "profile"));

                // 1. Create a valid mock .fig file (ZIP header PK\x03\x04 + payload)
                string figPath = Path.Combine(tempRoot, "sample.fig");
                byte[] figBytes = new byte[64];
                figBytes[0] = 0x50; // 'P'
                figBytes[1] = 0x4B; // 'K'
                figBytes[2] = 0x03;
                figBytes[3] = 0x04;
                for (int i = 4; i < figBytes.Length; i++) figBytes[i] = (byte)(i * 7);
                File.WriteAllBytes(figPath, figBytes);
                DateTime origWriteTime = File.GetLastWriteTimeUtc(figPath);
                string origSha = FigFigStore.ComputeSha256ReadOnly(figPath);

                // 2. Register read-only session and stream bytes
                var session = store.RegisterReadOnlyFile(figPath);
                Assert(session != null && !String.IsNullOrEmpty(session.Token), "Session token must be generated");
                Assert(session.Sha256 == origSha, "Session SHA-256 must match original file");
                Assert(session.ByteLength == 64, "Session byte length must match");

                using (var stream = store.OpenReadStream(session.Token))
                {
                    Assert(stream != null && stream.CanRead && !stream.CanWrite, "Stream must be strictly read-only");
                    Assert(stream.Length == 64, "Stream length must match");
                }

                // 3. Verify original file was not modified
                Assert(FigFigStore.ComputeSha256ReadOnly(figPath) == origSha, "Original .fig SHA-256 must remain identical");
                Assert(File.GetLastWriteTimeUtc(figPath) == origWriteTime, "Original .fig timestamp must remain untouched");

                // 4. Verify protection against overwriting .fig files
                bool blockedFigOverwrite = false;
                try
                {
                    FigFigStore.SaveExportedBytes(figPath, Convert.ToBase64String(Encoding.UTF8.GetBytes("<svg/>")));
                }
                catch (InvalidOperationException)
                {
                    blockedFigOverwrite = true;
                }
                Assert(blockedFigOverwrite, "Must forbid overwriting .fig files");

                // 5. Verify valid SVG export
                string svgOut = Path.Combine(tempRoot, "export.svg");
                FigFigStore.SaveExportedBytes(svgOut, Convert.ToBase64String(Encoding.UTF8.GetBytes("<svg xmlns=\"http://www.w3.org/2000/svg\"/>")));
                Assert(File.Exists(svgOut), "Valid SVG export must succeed");

                string htmlOut = Path.Combine(tempRoot, "export.html");
                string html = "<!doctype html><html><meta charset=\"utf-8\"><title>FigFig</title></html>";
                FigFigStore.SaveExportedBytes(htmlOut, Convert.ToBase64String(Encoding.UTF8.GetBytes(html)));
                Assert(File.ReadAllText(htmlOut, Encoding.UTF8) == html, "HTML export must preserve exact UTF-8 content");
                foreach (string extension in new[] { ".fig", ".deck", ".exe", ".ps1" })
                {
                    string target = Path.Combine(tempRoot, "blocked" + extension);
                    bool blocked = false;
                    try { FigFigStore.SaveExportedBytes(target, Convert.ToBase64String(Encoding.UTF8.GetBytes(html))); }
                    catch (InvalidOperationException) { blocked = true; }
                    Assert(blocked && !File.Exists(target), "Unsafe export extension must not be written: " + extension);
                }
                Assert(FigFigStore.ComputeSha256ReadOnly(figPath) == origSha, "Source must remain unchanged after all exports");
                Console.WriteLine("FIGFIG_NATIVE_TESTS_PASS (7/7)");
                return 0;
            }
            finally
            {
                try { Directory.Delete(tempRoot, true); } catch { }
            }
        }
    }
}
