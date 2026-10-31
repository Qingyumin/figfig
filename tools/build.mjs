import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "src");
const distDir = path.join(rootDir, "dist");
const assetsDir = path.join(rootDir, "assets");
const vendorDir = path.join(rootDir, "vendor");
const licensesDir = path.join(rootDir, "licenses");

fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });
fs.mkdirSync(vendorDir, { recursive: true });
fs.mkdirSync(licensesDir, { recursive: true });

// 1. Locate or cache the OpenFig + Kiwi + fflate + fzstd core bundle
const cachedVendorFile = path.join(vendorDir, "openfig-base.cjs");
const extWorkerPath = path.join(
  process.env.USERPROFILE || os.homedir(),
  ".vscode",
  "extensions",
  "figlens-local.figlens-0.1.0",
  "dist",
  "worker.cjs"
);

if (!fs.existsSync(cachedVendorFile)) {
  if (!fs.existsSync(extWorkerPath)) {
    throw new Error(`Cannot find base worker at ${extWorkerPath}`);
  }
  fs.copyFileSync(extWorkerPath, cachedVendorFile);
}

const rawLines = fs.readFileSync(cachedVendorFile, "utf8").split(/\r?\n/);

// Find exact markers in rawLines
const docMarkerIdx = rawLines.findIndex((l) => l.startsWith("var MAX_FILE_BYTES ="));
const svgBuilderMarkerIdx = rawLines.findIndex((l) =>
  l.startsWith("// output/figlens/dist/svg-builder.mjs")
);
const renderMarkerIdx = rawLines.findIndex(
  (l, idx) => idx > svgBuilderMarkerIdx && l.startsWith("// output/figlens/src/render.mjs")
);

if (docMarkerIdx < 0 || svgBuilderMarkerIdx < 0 || renderMarkerIdx < 0) {
  throw new Error(
    `Marker lookup failed: doc=${docMarkerIdx}, svgBuilder=${svgBuilderMarkerIdx}, render=${renderMarkerIdx}`
  );
}

// Section A: kiwi-schema + fflate + fzstd + openfig-core (lines 0 .. docMarkerIdx - 1)
let coreSection = rawLines.slice(0, docMarkerIdx).join("\n");
// Remove Node-only top-level requires injected by esbuild before fflate
coreSection = coreSection
  .replace(/var import_node_worker_threads = require\("node:worker_threads"\);\n?/g, "")
  .replace(/var import_promises2 = require\("node:fs\/promises"\);\n?/g, "")
  .replace(/var import_node_crypto = require\("node:crypto"\);\n?/g, "")
  .replace(/var import_module = require\("module"\);\nvar require2 = \(0, import_module\.createRequire\)\("\/"\);\nvar Worker;\ntry \{\n  Worker = require2\("worker_threads"\)\.Worker;\n\} catch \(e\) \{\n\}/g, "var Worker;");
// Upgrade roundPathNumber precision from 2 decimals to 4 decimals
coreSection = coreSection.replace(
  "function roundPathNumber(n, decimals = 2)",
  "function roundPathNumber(n, decimals = 4)"
);

// Section B: svg-builder (lines svgBuilderMarkerIdx .. renderMarkerIdx - 1)
let svgBuilderSection = rawLines.slice(svgBuilderMarkerIdx, renderMarkerIdx).join("\n");
svgBuilderSection = svgBuilderSection.replaceAll(
  'geo.windingRule === "EVENODD"',
  '(geo.windingRule === "ODD" || geo.windingRule === "EVENODD")'
);
svgBuilderSection = svgBuilderSection.replace(
  `  const stops = gradient.stops.map((s) => {\n    const color2 = cssColor(s.color ?? {});\n    return \`<stop offset="\${s.position}" stop-color="\${color2}"/>\`;\n  }).join("");`,
  `  const stops = gradient.stops.map((s) => {\n    const c = s.color ?? {};\n    const r = Math.round((c.r ?? 0) * 255);\n    const g = Math.round((c.g ?? 0) * 255);\n    const b = Math.round((c.b ?? 0) * 255);\n    const a = (c.a ?? 1).toFixed(4);\n    return \`<stop offset="\${s.position}" stop-color="rgb(\${r},\${g},\${b})" stop-opacity="\${a}"/>\`;\n  }).join("");`
);
svgBuilderSection = svgBuilderSection.replace(
  "const strokeSvg = rectStrokeSvg(0, 0, w, h, rx, stroke);",
  "const strokeSvg = frameStrokeSvgFast(node, w, h, rx, stroke);"
);
svgBuilderSection = svgBuilderSection.replace(
  `      const id = \`alpha-mask-\${++_svgIdSeq}\`;\n      const maskSvg = renderNode(deck, activeMask);\n      out.push(\n        \`<defs><mask id="\${id}" maskUnits="userSpaceOnUse" x="-100%" y="-100%" width="300%" height="300%" style="mask-type:alpha">\${maskSvg}</mask></defs>\`,\n        \`<g mask="url(#\${id})">\${body}</g>\`\n      );`,
  `      const id = \`alpha-mask-\${++_svgIdSeq}\`;\n      const maskStyle = activeMask.maskType === "LUMINANCE" ? "luminance" : "alpha";\n      const maskSvg = renderNode(deck, activeMask);\n      out.push(\n        \`<defs><mask id="\${id}" maskUnits="userSpaceOnUse" x="-100%" y="-100%" width="300%" height="300%" style="mask-type:\${maskStyle}">\${maskSvg}</mask></defs>\`,\n        \`<g mask="url(#\${id})">\${body}</g>\`\n      );`
);
svgBuilderSection = svgBuilderSection.replace(
  `    if (child.mask === true && child.maskType === "ALPHA") {`,
  `    if (child.mask === true) {`
);
svgBuilderSection = svgBuilderSection.replace(
  "function renderPlaceholder(deck, node) {",
  "function renderPlaceholder(deck, node) {\n  deck.reportPlaceholder?.(node);"
);

// Upgrade precision in svgBuilderSection
svgBuilderSection = svgBuilderSection.replace(
  "function f(v) {\n  return +v.toFixed(2);\n}",
  "function f(v) {\n  return +v.toFixed(4);\n}"
);

// Replace Node Buffer usage in decodeCmdBlob and blobToBuffer with isomorphic Uint8Array
svgBuilderSection = svgBuilderSection.replace(
  /function decodeCmdBlob\(blobs, blobIdx\) \{[\s\S]*?return cmds\.length \? cmds\.join\(""\) : null;\n\}/,
  `function decodeCmdBlob(blobs, blobIdx) {\n  return decodeCmdBlobFast(blobs, blobIdx);\n}`
);
svgBuilderSection = svgBuilderSection.replace(
  /function blobToBuffer\(blobs, blobIdx\) \{[\s\S]*?return buf;\n\}/,
  `function blobToBuffer(blobs, blobIdx) {\n  return toUint8Array(blobs?.[blobIdx]);\n}`
);

// Upgrade multi-level nested overrides in renderInstance (support guidPath.guids of any depth >= 1 + visible/opacity + stale derivedTextData invalidation)
svgBuilderSection = svgBuilderSection.replace(
  `  for (const ov of overrides) {\n    const guids = ov.guidPath?.guids;\n    if (!guids?.length || guids.length !== 1) continue;\n    const targetId = \`\${guids[0].sessionID}:\${guids[0].localID}\`;`,
  `  for (const ov of overrides) {\n    const guids = ov.guidPath?.guids;\n    if (!guids?.length) continue;\n    const leafGuid = guids[guids.length - 1];\n    const targetId = \`\${leafGuid.sessionID}:\${leafGuid.localID}\`;`
);

svgBuilderSection = svgBuilderSection.replace(
  `    if (ov.textData?.characters != null && target.textData) {\n      const origChars = target.textData.characters;\n      restores.push(() => {\n        target.textData.characters = origChars;\n      });\n      target.textData.characters = ov.textData.characters;\n    }`,
  `    if (ov.textData?.characters != null && target.textData) {\n      const origChars = target.textData.characters;\n      const origDerived = target.derivedTextData;\n      restores.push(() => {\n        target.textData.characters = origChars;\n        target.derivedTextData = origDerived;\n      });\n      target.textData.characters = ov.textData.characters;\n      if (ov.textData.characters !== origChars) {\n        target.derivedTextData = void 0;\n      }\n    }`
);

svgBuilderSection = svgBuilderSection.replace(
  `    if (ov.fillPaints) {\n      const origFill = target.fillPaints;\n      restores.push(() => {\n        target.fillPaints = origFill;\n      });\n      target.fillPaints = ov.fillPaints;\n    }`,
  `    if (ov.fillPaints) {\n      const origFill = target.fillPaints;\n      restores.push(() => {\n        target.fillPaints = origFill;\n      });\n      target.fillPaints = ov.fillPaints;\n    }\n    if (ov.visible !== undefined) {\n      const origVis = target.visible;\n      restores.push(() => {\n        target.visible = origVis;\n      });\n      target.visible = ov.visible;\n    }\n    if (ov.opacity !== undefined) {\n      const origOp = target.opacity;\n      restores.push(() => {\n        target.opacity = origOp;\n      });\n      target.opacity = ov.opacity;\n    }`
);

// Allow TEXT nodes without derived glyph blobs to cleanly use fallbackTextTspans
svgBuilderSection = svgBuilderSection.replace(
  `  const stale = isStaleLayout(chars, baselines, glyphs);\n  if (!glyphs?.length && !stale) {\n    throw new Error(\`TEXT \${node.name ?? nodeId2(node)} is missing derived glyph layout\`);\n  }`,
  `  const stale = isStaleLayout(chars, baselines, glyphs);`
);

// Upgrade renderRect to support independent 4-corner radii
svgBuilderSection = svgBuilderSection.replace(
  `function renderRect(deck, node) {\n  const { w, h } = size(node);\n  const rx = Math.min(node.cornerRadius ?? 0, w / 2, h / 2);`,
  `function renderRect(deck, node) {\n  const { w, h } = size(node);\n  const radiiInfo = getNodeRadii(node);\n  if (radiiInfo.independent) {\n    const pathD = independentRoundedRectPath(0, 0, w, h, radiiInfo.radii);\n    const fillColor = resolveFill(getFillPaints(node)) ?? "none";\n    const fillSvg = fillColor !== "none" ? \`<path d="\${pathD}" fill="\${fillColor}"/>\` : "";\n    const stroke = strokeSpec(node);\n    const strokeSvg = stroke ? \`<path d="\${pathD}" fill="none" stroke="\${stroke.color}" stroke-width="\${stroke.width}"/>\` : "";\n    const inner = [fillSvg, strokeSvg].filter(Boolean).join("\\n");\n    return inner ? \`<g transform="\${svgTransform(node)}">\\n\${inner}\\n</g>\` : "";\n  }\n  const rx = Math.min(node.cornerRadius ?? 0, w / 2, h / 2);`
);

// Combine with src/engine-ext.js and src/worker-entry.js
const engineExtCode = fs.readFileSync(path.join(srcDir, "engine-ext.js"), "utf8");
const workerEntryCode = fs.readFileSync(path.join(srcDir, "worker-entry.js"), "utf8");

const fullWorkerCode = [
  "// FigFig 1.0 Self-Contained Isomorphic Worker Bundle",
  coreSection,
  svgBuilderSection,
  engineExtCode,
  workerEntryCode
].join("\n\n");

fs.writeFileSync(path.join(distDir, "worker.js"), fullWorkerCode, "utf8");
fs.writeFileSync(path.join(distDir, "worker.cjs"), fullWorkerCode, "utf8");

// Copy UI files to dist/
fs.copyFileSync(path.join(srcDir, "index.html"), path.join(distDir, "index.html"));
fs.copyFileSync(path.join(srcDir, "app.css"), path.join(distDir, "app.css"));
fs.copyFileSync(path.join(srcDir, "app.js"), path.join(distDir, "app.js"));
fs.copyFileSync(
  path.join(rootDir, "THIRD-PARTY-NOTICES.txt"),
  path.join(licensesDir, "THIRD-PARTY-NOTICES.txt")
);

// 2. Generate a valid PNG buffer (for embedded image asset + icon)
function createSolidOrGradientPng(width, height, drawPixel) {
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    rawData[rowStart] = 0; // filter type 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height);
      const px = rowStart + 1 + x * 4;
      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
      rawData[px + 3] = a;
    }
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(rawData);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// Create FigFig.ico (contains 64x64 PNG icon)
function buildAppIconIco() {
  const png = createSolidOrGradientPng(64, 64, (x, y, w, h) => {
    const pad = 4;
    if (x < pad || y < pad || x >= w - pad || y >= h - pad) return [0, 0, 0, 0];
    // 4 quadrant rounded blocks inspired by FigFig logo
    const inLeft = x >= 6 && x <= 29;
    const inRight = x >= 34 && x <= 57;
    const inTop = y >= 6 && y <= 29;
    const inBot = y >= 34 && y <= 57;
    if (inLeft && inTop) return [16, 185, 129, 255]; // Emerald
    if (inRight && inTop) return [59, 130, 246, 255]; // Blue
    if (inLeft && inBot) return [139, 92, 246, 255]; // Purple
    if (inRight && inBot) return [245, 158, 11, 255]; // Amber
    return [20, 24, 31, 255];
  });
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // ICO
  header.writeUInt16LE(1, 4); // 1 image

  const entry = Buffer.alloc(16);
  entry[0] = 64;
  entry[1] = 64;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

await import("./branding.mjs");
for (const name of ["FigFig.ico", "FigFig-light.ico", "FigFig-dark.ico", "figfig-light.svg", "figfig-dark.svg", "figfig-light.png", "figfig-dark.png"]) {
  fs.copyFileSync(path.join(assetsDir, name), path.join(distDir, name));
}

// 3. Build a genuine, multi-page, lossless sample .fig archive (sample-showcase.fig)
function createZipArchive(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  for (const item of entries) {
    const nameBuf = Buffer.from(item.name, "utf8");
    const dataBuf = Buffer.isBuffer(item.data) ? item.data : Buffer.from(item.data);
    const crc = crc32(dataBuf);

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 flag
    local.writeUInt16LE(0, 8); // STORE (0)
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dataBuf.length, 18);
    local.writeUInt32LE(dataBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dataBuf.length, 20);
    central.writeUInt32LE(dataBuf.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);

    localParts.push(local, dataBuf);
    centralParts.push(central);
    offset += local.length + dataBuf.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuf, eocd]);
}

function createGlyphOutlineBlob() {
  // Valid binary command blob: M 0 0 L 0.65 0 L 0.65 0.72 L 0 0.72 Z
  const buf = Buffer.alloc(1 + 8 + 1 + 8 + 1 + 8 + 1 + 8 + 1);
  let off = 0;
  buf[off++] = 1; // MOVE_TO
  buf.writeFloatLE(0.05, off);
  off += 4;
  buf.writeFloatLE(0.0, off);
  off += 4;
  buf[off++] = 2; // LINE_TO
  buf.writeFloatLE(0.58, off);
  off += 4;
  buf.writeFloatLE(0.0, off);
  off += 4;
  buf[off++] = 2; // LINE_TO
  buf.writeFloatLE(0.58, off);
  off += 4;
  buf.writeFloatLE(0.68, off);
  off += 4;
  buf[off++] = 2; // LINE_TO
  buf.writeFloatLE(0.05, off);
  off += 4;
  buf.writeFloatLE(0.68, off);
  off += 4;
  buf[off++] = 0; // CLOSE
  return new Uint8Array(buf);
}

async function generateSampleFig() {
  // Dynamically import kiwi-schema from the compiled worker bundle
  const { createRequire } = await import("node:module");
  const requireCjs = createRequire(import.meta.url);

  // Extract kiwi-schema from cachedVendorFile by evaluating its commonJS module
  const kiwiSchemaText = `
    enum NodeType {
      DOCUMENT = 1;
      CANVAS = 2;
      FRAME = 3;
      GROUP = 4;
      VECTOR = 5;
      ROUNDED_RECTANGLE = 6;
      ELLIPSE = 7;
      TEXT = 8;
      SYMBOL = 9;
      INSTANCE = 10;
    }
    enum NodePhase {
      CREATED = 1;
      REMOVED = 2;
    }
    enum PaintType {
      SOLID = 1;
      GRADIENT_LINEAR = 2;
      GRADIENT_RADIAL = 3;
      IMAGE = 4;
    }
    enum StackMode {
      NONE = 1;
      HORIZONTAL = 2;
      VERTICAL = 3;
    }
    enum EffectType {
      DROP_SHADOW = 1;
      INNER_SHADOW = 2;
      LAYER_BLUR = 3;
    }
    struct GUID {
      uint sessionID;
      uint localID;
    }
    struct Vector2 {
      float x;
      float y;
    }
    struct Color {
      float r;
      float g;
      float b;
      float a;
    }
    struct Matrix {
      float m00;
      float m01;
      float m02;
      float m10;
      float m11;
      float m12;
    }
    struct ParentIndex {
      GUID guid;
      string position;
    }
    message ColorStop {
      Color color = 1;
      float position = 2;
    }
    message ImageRef {
      byte[] hash = 1;
      string name = 2;
    }
    message Paint {
      PaintType type = 1;
      bool visible = 2;
      float opacity = 3;
      Color color = 4;
      ColorStop[] stops = 5;
      Matrix transform = 6;
      ImageRef image = 7;
      string imageScaleMode = 8;
    }
    message FontName {
      string family = 1;
      string style = 2;
    }
    message Glyph {
      uint commandsBlob = 1;
      Vector2 position = 2;
      float fontSize = 3;
      uint firstCharacter = 4;
      float rotation = 5;
    }
    message Baseline {
      Vector2 position = 1;
      float width = 2;
      float lineY = 3;
      float lineHeight = 4;
      float lineAscent = 5;
      uint firstCharacter = 6;
      uint endCharacter = 7;
    }
    message DerivedTextData {
      Glyph[] glyphs = 1;
      Baseline[] baselines = 2;
    }
    message TextData {
      string characters = 1;
    }
    message GuidPath {
      GUID[] guids = 1;
    }
    message SymbolOverride {
      GuidPath guidPath = 1;
      TextData textData = 2;
      Paint[] fillPaints = 3;
      bool visible = 4;
      float opacity = 5;
      GUID overriddenSymbolID = 6;
    }
    message SymbolData {
      GUID symbolID = 1;
      SymbolOverride[] symbolOverrides = 2;
    }
    message Effect {
      EffectType type = 1;
      bool visible = 2;
      Color color = 3;
      Vector2 offset = 4;
      float radius = 5;
    }
    message Blob {
      byte[] bytes = 1;
    }
    message NodeChange {
      GUID guid = 1;
      NodePhase phase = 2;
      ParentIndex parentIndex = 3;
      NodeType type = 4;
      string name = 5;
      bool visible = 6;
      float opacity = 7;
      Vector2 size = 8;
      Matrix transform = 9;
      Paint[] fillPaints = 10;
      Paint[] strokePaints = 11;
      float strokeWeight = 12;
      string strokeAlign = 13;
      float cornerRadius = 14;
      bool rectangleCornerRadiiIndependent = 15;
      float rectangleTopLeftCornerRadius = 16;
      float rectangleTopRightCornerRadius = 17;
      float rectangleBottomRightCornerRadius = 18;
      float rectangleBottomLeftCornerRadius = 19;
      FontName fontName = 20;
      float fontSize = 21;
      TextData textData = 22;
      DerivedTextData derivedTextData = 23;
      SymbolData symbolData = 24;
      StackMode stackMode = 25;
      float stackSpacing = 26;
      float stackHorizontalPadding = 27;
      float stackVerticalPadding = 28;
      Effect[] effects = 29;
      bool internalOnly = 30;
    }
    message Message {
      NodeChange[] nodeChanges = 1;
      Blob[] blobs = 2;
    }
  `;

  // Load kiwi functions by extracting lines 24..1480 from cachedVendorFile
  const tempKiwiPath = path.join(vendorDir, "_kiwi_extract.cjs");
  const kiwiEndIdx = rawLines.findIndex((l) => l.startsWith("// output/figlens/node_modules/openfig-core"));
  // Wait: let's find where require_kiwi ends
  const fflateStartIdx = rawLines.findIndex((l) => l.includes("var u8 = Uint8Array"));
  const kiwiCode =
    rawLines.slice(0, fflateStartIdx).join("\n") + "\nmodule.exports = require_kiwi();\n";
  fs.writeFileSync(tempKiwiPath, kiwiCode, "utf8");
  const kiwi = requireCjs(tempKiwiPath);
  fs.unlinkSync(tempKiwiPath);

  const parsedSchema = kiwi.parseSchema(kiwiSchemaText);
  const binarySchema = kiwi.encodeBinarySchema(parsedSchema);
  const compiled = kiwi.compileSchema(parsedSchema);

  // Create embedded chart PNG asset
  const chartPng = createSolidOrGradientPng(320, 160, (x, y, w, h) => {
    // Crisp dark card with emerald bar chart
    const bars = [0.42, 0.68, 0.55, 0.85, 0.74, 0.92];
    const barW = 32;
    const gap = 16;
    const startX = 24;
    for (let i = 0; i < bars.length; i++) {
      const bx = startX + i * (barW + gap);
      const bh = Math.round(bars[i] * (h - 40));
      const by = h - 20 - bh;
      if (x >= bx && x < bx + barW && y >= by && y < h - 20) {
        return i === bars.length - 1 ? [16, 185, 129, 255] : [59, 130, 246, 255];
      }
    }
    return [24, 30, 40, 255];
  });
  const chartHashHex = crypto.createHash("sha1").update(chartPng).digest("hex");
  const chartHashBytes = new Uint8Array(Buffer.from(chartHashHex, "hex"));

  const mat = (x, y) => ({ m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y });
  const solid = (r, g, b, a = 1) => [
    { type: "SOLID", visible: true, opacity: a, color: { r: r / 255, g: g / 255, b: b / 255, a: 1 } }
  ];

  function makeTextNode(guid, parentGuid, pos, name, text, x, y, w, h, fontSize, rgb, useGlyphs = false) {
    const glyphs = [];
    if (useGlyphs) {
      for (let i = 0; i < Math.min(text.length, 24); i++) {
        glyphs.push({
          commandsBlob: 0,
          position: { x: i * (fontSize * 0.62), y: fontSize * 0.82 },
          fontSize,
          firstCharacter: i,
          rotation: 0
        });
      }
    }
    return {
      guid,
      phase: "CREATED",
      parentIndex: { guid: parentGuid, position: pos },
      type: "TEXT",
      name,
      visible: true,
      opacity: 1,
      size: { x: w, y: h },
      transform: mat(x, y),
      fillPaints: solid(rgb[0], rgb[1], rgb[2]),
      fontName: { family: "Microsoft YaHei UI", style: "SemiBold" },
      fontSize,
      textData: { characters: text },
      derivedTextData: {
        glyphs: useGlyphs ? glyphs : [],
        baselines: [
          {
            position: { x: 0, y: fontSize * 0.82 },
            width: w,
            lineY: 0,
            lineHeight: fontSize * 1.3,
            lineAscent: fontSize * 0.82,
            firstCharacter: 0,
            endCharacter: text.length
          }
        ]
      }
    };
  }

  const nodeChanges = [
    // Root Document
    {
      guid: { sessionID: 0, localID: 0 },
      phase: "CREATED",
      type: "DOCUMENT",
      name: "FigFig-Design-Showcase",
      visible: true
    },
    // Page 1: Cloud Analytics & Design Workbench
    {
      guid: { sessionID: 0, localID: 1 },
      phase: "CREATED",
      parentIndex: { guid: { sessionID: 0, localID: 0 }, position: "!" },
      type: "CANVAS",
      name: "01 · 云原生分析与设计工作台",
      visible: true
    },
    // Page 2: Design System Symbols (Internal Component Library)
    {
      guid: { sessionID: 0, localID: 2 },
      phase: "CREATED",
      parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '"' },
      type: "CANVAS",
      name: "02 · 核心设计系统组件库 (Symbols)",
      visible: true,
      internalOnly: true
    },

    // --- Page 2 Symbol: Metric Card (2:10) ---
    {
      guid: { sessionID: 2, localID: 10 },
      phase: "CREATED",
      parentIndex: { guid: { sessionID: 0, localID: 2 }, position: "!" },
      type: "SYMBOL",
      name: "Component / MetricCard 指标卡片",
      visible: true,
      opacity: 1,
      size: { x: 280, y: 128 },
      transform: mat(60, 60),
      fillPaints: solid(30, 41, 59),
      strokePaints: solid(51, 65, 85),
      strokeWeight: 1,
      strokeAlign: "INSIDE",
      cornerRadius: 12,
      stackMode: "VERTICAL",
      stackSpacing: 8,
      stackHorizontalPadding: 20,
      stackVerticalPadding: 18,
      effects: [
        {
          type: "DROP_SHADOW",
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.28 },
          offset: { x: 0, y: 6 },
          radius: 16
        }
      ]
    },
    makeTextNode(
      { sessionID: 2, localID: 11 },
      { sessionID: 2, localID: 10 },
      "!",
      "MetricTitle",
      "今日活跃请求吞吐量",
      20,
      22,
      220,
      22,
      14,
      [148, 163, 184]
    ),
    makeTextNode(
      { sessionID: 2, localID: 12 },
      { sessionID: 2, localID: 10 },
      '"',
      "MetricValue",
      "1,284 QPS (+18.6%)",
      20,
      58,
      240,
      40,
      26,
      [16, 185, 129]
    ),
    {
      guid: { sessionID: 2, localID: 20 }, phase: "CREATED", type: "SYMBOL",
      parentIndex: { guid: { sessionID: 0, localID: 2 }, position: "#" },
      name: "Nested Metric", visible: true, size: { x: 280, y: 128 }, transform: mat(400, 60)
    },
    {
      guid: { sessionID: 2, localID: 21 }, phase: "CREATED", type: "INSTANCE",
      parentIndex: { guid: { sessionID: 2, localID: 20 }, position: "!" },
      name: "Nested Metric Content", visible: true, size: { x: 280, y: 128 }, transform: mat(0, 0),
      symbolData: { symbolID: { sessionID: 2, localID: 10 }, symbolOverrides: [] }
    },

    // --- Page 1 Frame 1: Desktop Analytics Dashboard (1:100) ---
    {
      guid: { sessionID: 1, localID: 100 },
      phase: "CREATED",
      parentIndex: { guid: { sessionID: 0, localID: 1 }, position: "!" },
      type: "FRAME",
      name: "云原生应用性能与资源监控驾驶舱 (1280×800)",
      visible: true,
      opacity: 1,
      size: { x: 1280, y: 800 },
      transform: mat(0, 0),
      fillPaints: solid(15, 23, 42),
      cornerRadius: 0
    },
    // Top Header Bar (1:101)
    {
      guid: { sessionID: 1, localID: 101 },
      phase: "CREATED",
      parentIndex: { guid: { sessionID: 1, localID: 100 }, position: "!" },
      type: "ROUNDED_RECTANGLE",
      name: "TopNavigationBar 顶部导航栏",
      visible: true,
      opacity: 1,
      size: { x: 1232, y: 64 },
      transform: mat(24, 20),
      fillPaints: solid(30, 41, 59),
      strokePaints: solid(51, 65, 85),
      strokeWeight: 1,
      cornerRadius: 10
    },
    makeTextNode(
      { sessionID: 1, localID: 102 },
      { sessionID: 1, localID: 100 },
      '"',
      "HeaderBrandTitle",
      "FigFig · 实时可观测性与服务健康度中心",
      48,
      40,
      620,
      28,
      18,
      [248, 250, 252],
      true
    ),
    // Primary CTA Button with Independent Corner Radii (1:103)
    {
      guid: { sessionID: 1, localID: 103 },
      phase: "CREATED",
      parentIndex: { guid: { sessionID: 1, localID: 100 }, position: "#" },
      type: "ROUNDED_RECTANGLE",
      name: "BtnPrimaryAction 一键诊断按钮",
      visible: true,
      opacity: 1,
      size: { x: 168, y: 40 },
      transform: mat(1068, 32),
      fillPaints: solid(16, 185, 129),
      rectangleCornerRadiiIndependent: true,
      rectangleTopLeftCornerRadius: 14,
      rectangleTopRightCornerRadius: 4,
      rectangleBottomRightCornerRadius: 14,
      rectangleBottomLeftCornerRadius: 4
    },
    makeTextNode(
      { sessionID: 1, localID: 104 },
      { sessionID: 1, localID: 100 },
      "$",
      "BtnExecuteLabel",
      "一键生成诊断报告",
      1088,
      42,
      132,
      20,
      14,
      [255, 255, 255]
    ),
    // Instance 1 of MetricCard (1:105)
    {
      guid: { sessionID: 1, localID: 105 },
      phase: "CREATED",
      parentIndex: { guid: { sessionID: 1, localID: 100 }, position: "%" },
      type: "INSTANCE",
      name: "KPI卡片 · 服务可用率",
      visible: true,
      opacity: 1,
      size: { x: 280, y: 128 },
      transform: mat(24, 108),
      symbolData: {
        symbolID: { sessionID: 2, localID: 10 },
        symbolOverrides: [
          {
            guidPath: { guids: [{ sessionID: 2, localID: 11 }] },
            textData: { characters: "核心服务 SLA 可用率" }
          },
          {
            guidPath: { guids: [{ sessionID: 2, localID: 12 }] },
            textData: { characters: "99.42%" }
          }
        ]
      }
    },
    // Instance 2 of MetricCard with multi-guid nested path override (1:106)
    {
      guid: { sessionID: 1, localID: 106 },
      phase: "CREATED",
      parentIndex: { guid: { sessionID: 1, localID: 100 }, position: "&" },
      type: "INSTANCE",
      name: "KPI卡片 · 集群平均负载",
      visible: true,
      opacity: 1,
      size: { x: 280, y: 128 },
      transform: mat(328, 108),
      symbolData: {
        symbolID: { sessionID: 2, localID: 20 },
        symbolOverrides: [
          {
            guidPath: {
              guids: [
                { sessionID: 2, localID: 21 },
                { sessionID: 2, localID: 11 }
              ]
            },
            textData: { characters: "核心集群计算节点负载" }
          },
          {
            guidPath: {
              guids: [
                { sessionID: 2, localID: 21 },
                { sessionID: 2, localID: 12 }
              ]
            },
            textData: { characters: "87.5% (正常)" },
            fillPaints: solid(59, 130, 246)
          }
        ]
      }
    },
    // Embedded Image Card (1:107)
    {
      guid: { sessionID: 1, localID: 107 },
      phase: "CREATED",
      parentIndex: { guid: { sessionID: 1, localID: 100 }, position: "'" },
      type: "ROUNDED_RECTANGLE",
      name: "ChartImageContainer 流量趋势原图组件",
      visible: true,
      opacity: 1,
      size: { x: 624, y: 240 },
      transform: mat(632, 108),
      cornerRadius: 12,
      fillPaints: [
        {
          type: "IMAGE",
          visible: true,
          opacity: 1,
          image: { hash: chartHashBytes, name: chartHashHex },
          imageScaleMode: "FILL"
        }
      ],
      strokePaints: solid(59, 130, 246),
      strokeWeight: 1.5
    },
    // Main Table Panel (1:108)
    {
      guid: { sessionID: 1, localID: 108 },
      phase: "CREATED",
      parentIndex: { guid: { sessionID: 1, localID: 100 }, position: "(" },
      type: "FRAME",
      name: "ServiceNodeTable 服务节点监控明细表",
      visible: true,
      opacity: 1,
      size: { x: 1232, y: 400 },
      transform: mat(24, 372),
      fillPaints: solid(30, 41, 59),
      strokePaints: solid(51, 65, 85),
      strokeWeight: 1,
      cornerRadius: 12,
      stackMode: "VERTICAL",
      stackSpacing: 12,
      stackHorizontalPadding: 24,
      stackVerticalPadding: 20
    },
    makeTextNode(
      { sessionID: 1, localID: 109 },
      { sessionID: 1, localID: 108 },
      "!",
      "TableTitle",
      "活跃服务节点列表 · 支持按节点编号、可用区、部署版本快速过滤",
      24,
      24,
      780,
      26,
      16,
      [226, 232, 240]
    ),

    // --- Page 1 Frame 2: Mobile Inspector (1:200) ---
    {
      guid: { sessionID: 1, localID: 200 },
      phase: "CREATED",
      parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
      type: "FRAME",
      name: "移动端服务巡检与实时告警终端 (390×844)",
      visible: true,
      opacity: 1,
      size: { x: 390, y: 844 },
      transform: mat(1360, 0),
      fillPaints: solid(15, 23, 42),
      cornerRadius: 24
    },
    {
      guid: { sessionID: 1, localID: 201 },
      phase: "CREATED",
      parentIndex: { guid: { sessionID: 1, localID: 200 }, position: "!" },
      type: "ROUNDED_RECTANGLE",
      name: "MobileScanCard 巡检核验卡片",
      visible: true,
      opacity: 1,
      size: { x: 350, y: 180 },
      transform: mat(20, 48),
      fillPaints: solid(30, 41, 59),
      strokePaints: solid(16, 185, 129),
      strokeWeight: 2,
      cornerRadius: 16
    },
    makeTextNode(
      { sessionID: 1, localID: 202 },
      { sessionID: 1, localID: 200 },
      '"',
      "MobileScanTitle",
      "实时服务健康巡检与告警通知",
      40,
      80,
      310,
      28,
      16,
      [16, 185, 129]
    ),

    // --- Page 1 Frame 3: Tall Form Detail Page (1440×1204) for Fit-to-Viewport Stability ---
    {
      guid: { sessionID: 1, localID: 300 },
      phase: "CREATED",
      parentIndex: { guid: { sessionID: 0, localID: 1 }, position: "#" },
      type: "FRAME",
      name: "多步骤流程配置与长表单详情页 (1440×1204)",
      visible: true,
      opacity: 1,
      size: { x: 1440, y: 1204 },
      transform: mat(1840, 0),
      fillPaints: solid(248, 249, 255),
      cornerRadius: 0
    },
    {
      guid: { sessionID: 1, localID: 301 },
      phase: "CREATED",
      parentIndex: { guid: { sessionID: 1, localID: 300 }, position: "!" },
      type: "ROUNDED_RECTANGLE",
      name: "FormSectionCard 常规配置区",
      visible: true,
      opacity: 1,
      size: { x: 1320, y: 280 },
      transform: mat(60, 80),
      fillPaints: solid(255, 255, 255),
      strokePaints: solid(226, 232, 240),
      strokeWeight: 1,
      cornerRadius: 16
    },
    makeTextNode(
      { sessionID: 1, localID: 302 },
      { sessionID: 1, localID: 300 },
      '"',
      "FormSectionTitle",
      "常规配置区 · 基本参数与阈值规则明细",
      96,
      108,
      420,
      28,
      16,
      [30, 41, 59],
      true
    )
  ];

  const encodedMessage = compiled.encodeMessage({
    nodeChanges,
    blobs: [{ bytes: createGlyphOutlineBlob() }]
  });

  const chunk0 = zlib.deflateRawSync(Buffer.from(binarySchema));
  const chunk1 = zlib.deflateRawSync(Buffer.from(encodedMessage));

  const canvasFig = Buffer.alloc(12 + 4 + chunk0.length + 4 + chunk1.length);
  canvasFig.write("fig-kiwi", 0, "ascii");
  canvasFig.writeUInt32LE(52, 8);
  let ptr = 12;
  canvasFig.writeUInt32LE(chunk0.length, ptr);
  ptr += 4;
  chunk0.copy(canvasFig, ptr);
  ptr += chunk0.length;
  canvasFig.writeUInt32LE(chunk1.length, ptr);
  ptr += 4;
  chunk1.copy(canvasFig, ptr);

  const metaJson = Buffer.from(
    JSON.stringify({
      file_name: "FigFig-Design-Showcase",
      exported_at: "2026-10-30T00:00:00Z",
      generator: "FigFig 1.2 Showcase Builder"
    }),
    "utf8"
  );

  const zipBytes = createZipArchive([
    { name: "canvas.fig", data: canvasFig },
    { name: "meta.json", data: metaJson },
    { name: "thumbnail.png", data: chartPng },
    { name: `images/${chartHashHex}`, data: chartPng }
  ]);

  fs.writeFileSync(path.join(assetsDir, "sample-showcase.fig"), zipBytes);
  fs.writeFileSync(path.join(distDir, "sample-showcase.fig"), zipBytes);
}

await generateSampleFig();
console.log("FIGFIG_WEB_BUILD_OK", distDir);
