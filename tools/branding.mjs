import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = path.join(root, "vendor");
fs.mkdirSync(vendorDir, { recursive: true });

// Ensure local resvg.wasm and resvg.cjs are extracted in vendor/
const extDistDir = path.join(
  process.env.USERPROFILE || os.homedir(),
  ".vscode",
  "extensions",
  "figlens-local.figlens-0.1.0",
  "dist"
);
const wasmPath = path.join(vendorDir, "resvg.wasm");
if (!fs.existsSync(wasmPath)) {
  fs.copyFileSync(path.join(extDistDir, "resvg.wasm"), wasmPath);
}

const resvgCjsPath = path.join(vendorDir, "resvg.cjs");
if (!fs.existsSync(resvgCjsPath)) {
  const basePath = path.join(vendorDir, "openfig-base.cjs");
  const lines = fs.readFileSync(basePath, "utf8").split(/\r?\n/);
  const startIdx = lines.findIndex((l) => l.startsWith("// output/figlens/node_modules/@resvg/resvg-wasm/index.mjs"));
  const endIdx = lines.findIndex((l) => l.startsWith("// output/figlens/dist/svg-builder.mjs"));
  if (startIdx < 0 || endIdx < 0) throw new Error("Cannot locate resvg-wasm in openfig-base.cjs");
  const code = lines.slice(startIdx, endIdx).join("\n") + "\nmodule.exports = { initWasm, Resvg: Resvg2 };\n";
  fs.writeFileSync(resvgCjsPath, code, "utf8");
}

const requireCjs = createRequire(import.meta.url);
const { initWasm, Resvg } = requireCjs(resvgCjsPath);
try {
  await initWasm(fs.readFileSync(wasmPath));
} catch (err) {
  if (!String(err?.message || err).includes("Already initialized")) throw err;
}

const directory = path.join(root, "assets");
fs.mkdirSync(directory, { recursive: true });

// Four distinct corner colors adapted for light and dark themes, matching the folded pinwheel geometry in Image 1
const palettes = {
  light: {
    outline: "#ffffff",
    blades: [
      { main: "#d92b3a", fold: "#c42030" }, // Top-Right: Crimson Red
      { main: "#0e74bc", fold: "#0b63a2" }, // Bottom-Right: Cerulean Blue
      { main: "#e0921f", fold: "#c97e12" }, // Bottom-Left: Amber Gold
      { main: "#168a74", fold: "#117360" }  // Top-Left: Inklet Jade Teal
    ]
  },
  dark: {
    outline: "#152022",
    blades: [
      { main: "#f24858", fold: "#d93444" }, // Top-Right: Luminous Coral Red
      { main: "#3698eb", fold: "#227fd1" }, // Bottom-Right: Luminous Sky Blue
      { main: "#f7b038", fold: "#df9620" }, // Bottom-Left: Luminous Gold
      { main: "#28b89e", fold: "#1a9c84" }  // Top-Left: Luminous Jade
    ]
  }
};

// Exact folded paper pinwheel geometry matching Image 1:
// 1. Outer main wing extending to the rounded corner tip and returning diagonally toward the hub
const wingPath =
  "M 126 122 C 122 94 126 62 135 37 C 140 24 150 18 168 18 L 212 18 C 225 18 230 27 221 36 L 143 114 C 136 121 130 124 126 122 Z";
// 2. Inner folded triangle tucked between the diagonal edge of this wing and the curved back of the next wing
const foldPath =
  "M 136 122 L 173 85 L 213 125 C 187 117 161 118 136 128 Z";
// 3. Center overlapping pinwheel tongue (as in Image 1 where the top-left flap overlaps the center with a rounded tip)
const centerTonguePath =
  "M 96 104 L 128 72 C 123 98 125 120 135 138 C 139 146 131 154 122 148 C 110 138 102 122 96 104 Z";

export function buildWindmillSvg(theme = "light") {
  const pal = palettes[theme] || palettes.light;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <g stroke="${pal.outline}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
    ${pal.blades
      .map(
        (b, index) => `<g transform="rotate(${index * 90} 128 128)">
      <path d="${foldPath}" fill="${b.fold}"/>
      <path d="${wingPath}" fill="${b.main}"/>
    </g>`
      )
      .join("\n    ")}
    <path d="${centerTonguePath}" fill="${pal.blades[3].main}"/>
  </g>
</svg>`;
}

function rasterizeWithPixels(source, size) {
  const renderer = new Resvg(source, { fitTo: { mode: "width", value: size } });
  const image = renderer.render();
  try {
    return {
      size,
      bytes: Buffer.from(image.asPng()),
      pixels: new Uint8Array(image.pixels),
      width: image.width,
      height: image.height
    };
  } finally {
    image.free();
    renderer.free();
  }
}

function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, bytes }, index) => {
    const position = 6 + index * 16;
    header[position] = size === 256 ? 0 : size;
    header[position + 1] = header[position];
    header.writeUInt16LE(1, position + 4);
    header.writeUInt16LE(32, position + 6);
    header.writeUInt32LE(bytes.length, position + 8);
    header.writeUInt32LE(offset, position + 12);
    offset += bytes.length;
  });
  return Buffer.concat([header, ...images.map(({ bytes }) => bytes)]);
}

const checks = [];
for (const theme of ["light", "dark"]) {
  const pal = palettes[theme];
  const source = buildWindmillSvg(theme);
  fs.writeFileSync(path.join(directory, `figfig-${theme}.svg`), source, "utf8");
  const images = [16, 20, 24, 32, 40, 48, 64, 128, 256].map((size) =>
    rasterizeWithPixels(source, size)
  );
  const largest = images.at(-1);
  assert.equal(largest.pixels[3], 0, "Icon corners must be transparent.");
  for (const blade of pal.blades) {
    const color = blade.main;
    const channels = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
    let matchedPixels = 0;
    for (let offset = 0; offset < largest.pixels.length; offset += 4) {
      if (
        channels.every((ch, idx) => Math.abs(largest.pixels[offset + idx] - ch) <= 3) &&
        largest.pixels[offset + 3] === 255
      ) {
        matchedPixels += 1;
      }
    }
    assert(matchedPixels > 1200, `Each windmill blade (${color}) must keep its own visible color (got ${matchedPixels}).`);
  }
  fs.writeFileSync(path.join(directory, `figfig-${theme}.png`), largest.bytes);
  fs.writeFileSync(path.join(directory, `FigFig-${theme}.ico`), ico(images));
  checks.push({
    theme,
    sizes: images.map(({ size }) => size),
    colors: pal.blades.map((b) => b.main),
    transparent: true
  });
}

fs.copyFileSync(path.join(directory, "FigFig-light.ico"), path.join(directory, "FigFig.ico"));
fs.writeFileSync(
  path.join(directory, "branding.json"),
  JSON.stringify({ design: "Four-blade multi-color windmill adapted for light & dark themes", checks }, null, 2),
  "utf8"
);
console.log("FIGFIG_BRANDING_OK", JSON.stringify(checks));
