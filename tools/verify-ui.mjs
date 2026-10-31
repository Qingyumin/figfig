import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.argv.includes("--rebuild")) execFileSync(process.execPath, [path.join(root, "tools/build.mjs")], { stdio: "inherit" });
const dist = path.join(root, "dist");
const output = path.join(os.tmpdir(), `figfig-ui-verify-${Date.now()}`);
fs.mkdirSync(output, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(root, "../../.venv/Lib/site-packages/playwright/driver/package/index.js"));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const filename = path.resolve(dist, `.${pathname === "/" ? "/index.html" : pathname}`);
  if (path.relative(dist, filename).startsWith("..") || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) { response.writeHead(404).end(); return; }
  response.writeHead(200, { "Content-Type": types[path.extname(filename)] || "application/octet-stream" });
  fs.createReadStream(filename).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
async function launchEdge() {
  const attempts = [
    { channel: "msedge", headless: true, args: ["--headless=new", "--disable-gpu"] },
    { channel: "msedge", headless: true, args: ["--disable-gpu", "--no-sandbox"] },
    { channel: "msedge", headless: false, args: ["--window-position=-32000,-32000", "--disable-gpu"] }
  ];
  let lastErr;
  for (const opts of attempts) {
    for (let retry = 0; retry < 2; retry++) {
      try {
        return await chromium.launch(opts);
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }
  throw lastErr;
}
const browser = await launchEdge();
const report = { timestamp: new Date().toISOString(), checks: [], errors: [], externalRequests: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1.25, acceptDownloads: true });
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.route("**/*", (route) => {
    if (route.request().url().startsWith(base)) return route.continue();
    report.externalRequests.push(route.request().url());
    return route.abort();
  });
  const ready = () => page.waitForFunction(() => document.body.dataset.ready === "true" && window.__figfigApp.getActiveTab()?.nativeWidth);
  await page.goto(base);
  await ready();
  const widths = () => page.evaluate(() => ({ left: Math.round(document.querySelector(".sidebar").getBoundingClientRect().width), right: Math.round(document.querySelector(".inspector").getBoundingClientRect().width), canvas: Math.round(document.querySelector(".canvas-area").getBoundingClientRect().width) }));
  assert.deepEqual(await widths(), { left: 268, right: 308, canvas: 852 });
  async function drag(id, delta) {
    const box = await page.locator(id).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 70);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + delta, box.y + 70, { steps: 8 });
    await page.mouse.up();
  }
  await drag("#resize-sidebar", 90);
  await drag("#resize-inspector", -60);
  assert.deepEqual(await widths(), { left: 358, right: 368, canvas: 702 });
  report.checks.push({ name: "pointer-resize-both-panels", actual: await widths() });
  await page.reload(); await ready();
  assert.deepEqual(await widths(), { left: 358, right: 368, canvas: 702 });
  report.checks.push({ name: "panel-widths-survive-reload", passed: true });
  await page.locator("#resize-sidebar").focus(); await page.keyboard.press("ArrowRight");
  assert.equal((await widths()).left, 368);
  await page.keyboard.press("Home");
  await page.locator("#resize-inspector").dblclick({ position: { x: 3, y: 70 } });
  assert.deepEqual(await widths(), { left: 268, right: 308, canvas: 852 });
  report.checks.push({ name: "keyboard-resize-and-default-reset", passed: true });

  // Verify tall frame (1:300, 1440x1204) anti-jitter stability at fractional DPI (1.25x)
  await page.evaluate(() => window.__figfigApp.selectNodeAndRender("1:300", true));
  const tallStability = await page.evaluate(async () => {
    const samples = [];
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      const wrap = document.getElementById("board-wrap").getBoundingClientRect();
      const vp = document.getElementById("viewport");
      samples.push({
        scale: window.__figfigApp.getActiveTab().scale,
        w: Math.round(wrap.width),
        h: Math.round(wrap.height),
        vpW: vp.clientWidth,
        vpH: vp.clientHeight,
        isFitted: vp.classList.contains("is-fitted")
      });
    }
    const first = samples[0];
    const jitter = samples.filter(
      (s) => s.scale !== first.scale || s.w !== first.w || s.h !== first.h || s.vpW !== first.vpW || s.vpH !== first.vpH
    ).length;
    return { jitter, first };
  });
  assert.equal(tallStability.jitter, 0, "Tall frame (1440x1204) must have zero layout jitter across 20 animation frames.");
  assert.equal(tallStability.first.isFitted, true, "Viewport must keep is-fitted overflow guard active.");
  report.checks.push({ name: "tall-frame-1440x1204-anti-jitter-stability", ...tallStability.first });

  const labels = await page.locator(".node-item-title").evaluateAll((elements) => elements.map((element) => ({ width: element.clientWidth, scrollWidth: element.scrollWidth, height: element.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(element).lineHeight), wrapping: getComputedStyle(element).whiteSpace })));
  assert(labels.some((entry) => entry.height > entry.lineHeight * 1.5), "Long frame names must wrap at the default sidebar width.");
  assert(labels.every((entry) => entry.scrollWidth <= entry.width + 1), "Frame names must not overflow their row.");
  report.checks.push({ name: "frame-name-wrapping", rows: labels.length });

  for (const scale of [1, 2]) {
    await page.locator("#png-scale-select").selectOption(String(scale));
    const downloadEvent = page.waitForEvent("download");
    await page.locator("#btn-export-png").click();
    const download = await downloadEvent;
    const filename = path.join(output, `export-${scale}x.png`);
    await download.saveAs(filename);
    const png = fs.readFileSync(filename);
    assert.equal(png.readUInt32BE(16), 1440 * scale);
    assert.equal(png.readUInt32BE(20), 1204 * scale);
    report.checks.push({ name: `png-export-${scale}x`, width: png.readUInt32BE(16), height: png.readUInt32BE(20) });
  }
  const largePngs = await page.evaluate(() => [[30000, 10000, 4], [10000, 30000, 3], [12000, 12000, 4]].map(([width, height, scale]) => ({ width, height, output: window.__figfigApp.getPngExportDimensions(width, height, scale) })));
  for (const image of largePngs) {
    assert(image.output.width <= 16384 && image.output.height <= 16384);
    assert(image.output.width * image.output.height <= 32 * 1024 * 1024);
    assert(Math.abs(image.output.width / image.output.height - image.width / image.height) < 0.001);
  }
  report.checks.push({ name: "large-png-aspect-and-pixel-limit", cases: largePngs });
  const htmlEvent = page.waitForEvent("download");
  await page.locator("#btn-export-html").click();
  const htmlDownload = await htmlEvent;
  const htmlPath = path.join(output, "export-board.html");
  await htmlDownload.saveAs(htmlPath);
  const html = fs.readFileSync(htmlPath, "utf8");
  assert(html.includes('width="1440" height="1204"'));
  assert(!/<script\b/i.test(html));
  const exportedPage = await browser.newPage({ viewport: { width: 390, height: 800 } });
  const external = [];
  await exportedPage.route("**/*", (route) => { external.push(route.request().url()); return route.abort(); });
  await exportedPage.setContent(html);
  await exportedPage.locator("img").evaluate((image) => image.decode());
  const exported = await exportedPage.locator("img").evaluate((image) => ({ width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight }));
  assert.deepEqual(exported, { width: 1440, height: 1204, naturalWidth: 1440, naturalHeight: 1204 });
  assert.equal(external.length, 0, "Exported HTML must open without external resources.");
  await exportedPage.close();
  report.checks.push({ name: "html-export-original-size-offline", ...exported, externalRequests: external.length });

  await page.evaluate(() => window.__figfigApp.selectNodeAndRender("1:100", true));
  await page.locator("#search-input").fill("SLA");
  await page.waitForFunction(() => (document.querySelector("#nav-list")?.textContent || "").includes("SLA"));
  assert((await page.locator("#nav-list").textContent()).includes("SLA"));
  await page.locator("#search-all-pages").uncheck();
  await page.locator("#search-input").fill("no-such-node-FigFig-817263");
  await page.waitForFunction(() => document.querySelectorAll("#nav-list .node-item").length === 0);
  await page.locator("#search-all-pages").check();
  await page.locator("#search-input").fill("");
  await page.waitForFunction(() => document.querySelectorAll("#nav-list .node-item").length === 3);
  await page.locator("#include-internal").check();
  await page.waitForFunction(() => document.querySelector("#page-select").options.length === 2);
  await page.locator("#include-internal").uncheck();
  await page.waitForFunction(() => document.querySelector("#page-select").options.length === 1);
  report.checks.push({ name: "search-empty-result-page-scope-and-internal-pages", passed: true });

  await page.locator("#tab-layers").click();
  await page.locator("#nav-list .drill-btn").first().click();
  await page.waitForFunction(() => !document.querySelector("#layer-breadcrumbs").hidden);
  await page.locator("#layer-breadcrumbs button").first().click();
  await page.locator("#tab-frames").click();

  await page.evaluate(() => window.__figfigApp.selectNodeAndRender("1:100", true));
  const targets = await page.evaluate(() => {
    const tab = window.__figfigApp.getActiveTab();
    return {
      width: tab.nativeWidth,
      height: tab.nativeHeight,
      first: tab.hitBoxes.find((box) => box.id === "1:105" || box.sourceId === "1:105"),
      second: tab.hitBoxes.find((box) => box.id === "1:106" || box.sourceId === "1:106")
    };
  });
  assert(targets.first && targets.second);
  const overlay = await page.locator("#hit-overlay").boundingBox();
  const point = (box) => ({ x: overlay.x + (box.x + box.w / 2) * overlay.width / targets.width, y: overlay.y + (box.y + box.h / 2) * overlay.height / targets.height });
  await page.mouse.click(point(targets.first).x, point(targets.first).y);
  await page.locator("#toggle-measure").click();
  await page.mouse.move(point(targets.second).x, point(targets.second).y);
  await page.waitForFunction(() => document.querySelector("#hit-overlay text")?.textContent.endsWith("px"));
  report.checks.push({ name: "actual-hit-selection-and-distance-guides", labels: await page.locator("#hit-overlay text").allTextContents() });
  await page.locator("#toggle-measure").click();
  await page.locator("#toggle-inspect").click();
  await page.mouse.move(point(targets.second).x, point(targets.second).y);
  assert(await page.locator("#hit-overlay rect[stroke-dasharray]").count() === 0);
  await page.locator("#toggle-inspect").click();

  for (const expected of [false, true]) {
    const uri = await page.locator("#preview-img").getAttribute("src");
    await page.locator("#toggle-glyphs").click();
    await page.waitForFunction((previous) => document.querySelector("#preview-img").src !== previous, uri);
    assert.equal(await page.locator("#toggle-glyphs").evaluate((button) => button.classList.contains("active")), expected);
  }
  report.checks.push({ name: "inspection-toggle-and-glyph-rendering-switch", passed: true });

  await page.locator("#zoom-input").fill("200"); await page.locator("#zoom-input").press("Enter");
  await page.locator("#btn-zoom-100").click();
  assert.equal(await page.locator("#zoom-input").inputValue(), "100");
  await page.locator("#btn-zoom-in").click(); assert.equal(await page.locator("#zoom-input").inputValue(), "125");
  await page.locator("#btn-zoom-out").click(); assert.equal(await page.locator("#zoom-input").inputValue(), "100");
  await page.locator("#btn-zoom-fit").click();
  await page.locator("#mode-gallery").click();
  await page.waitForFunction(() => document.querySelectorAll(".gallery-card").length === 3);
  await page.locator(".gallery-card").first().click();
  await page.waitForFunction(() => !document.querySelector("#stage").hidden && !document.querySelector("#board-wrap").hidden);
  report.checks.push({ name: "zoom-controls-gallery-and-return", passed: true });

  await page.evaluate(() => window.__figfigApp.selectNodeAndRender("1:100", true));
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press("1");
  assert.equal(await page.locator("#zoom-input").inputValue(), "100");
  assert.equal(await page.evaluate(() => window.__figfigApp.getActiveTab().fitted), false);
  await page.keyboard.press("+"); assert.equal(await page.locator("#zoom-input").inputValue(), "125");
  await page.keyboard.press("-"); assert.equal(await page.locator("#zoom-input").inputValue(), "100");
  await page.keyboard.press("i"); assert.equal(await page.locator("#toggle-inspect").evaluate((button) => button.classList.contains("active")), false);
  await page.keyboard.press("i"); await page.keyboard.press("f");
  assert.equal(await page.evaluate(() => window.__figfigApp.getActiveTab().fitted), true);
  await page.keyboard.press("Control+f");
  assert.equal(await page.evaluate(() => document.activeElement.id), "search-input");
  await page.evaluate(() => document.activeElement.blur());
  report.checks.push({ name: "advertised-keyboard-shortcuts", keys: ["1", "+", "-", "I", "F", "Ctrl+F"] });
  for (const theme of ["light", "sepia", "dark"]) {
    assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
    await page.locator("#btn-theme").click();
  }
  for (const width of [1000, 760, 390]) {
    await page.setViewportSize({ width, height: 860 });
    await page.waitForFunction(() => document.querySelector(".workspace").clientWidth === innerWidth);
    const layout = await page.evaluate(() => ({ rootWidth: document.documentElement.scrollWidth, innerWidth, canvasWidth: document.querySelector(".canvas-area").clientWidth, toolbarRight: document.querySelector(".topbar-actions").getBoundingClientRect().right }));
    assert(layout.canvasWidth >= 139, "The canvas must retain usable width.");
    assert(layout.rootWidth <= width && layout.toolbarRight <= width + 1, "Workspace or toolbar overflows the viewport.");
    report.checks.push({ name: `viewport-${width}`, ...layout });
  }
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
  assert.equal(report.externalRequests.length, 0, "UI must not depend on external resources.");
  report.passed = true;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  try { fs.rmSync(output, { recursive: true, force: true }); } catch {}
}
console.log(JSON.stringify(report, null, 2));