#!/usr/bin/env node
/**
 * FigFig Model Context Protocol (MCP 2024-11-05) Stdio Server
 * Enables VS Code GitHub Copilot, Claude Desktop, Cursor, Windsurf, and any MCP client
 * to directly inspect, search, read node properties/CSS, and render SVG/PNG screenshots
 * from local Figma (.fig / .deck) files with strict read-only guarantees.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import readline from "node:readline";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireCjs = createRequire(import.meta.url);

// Resolve engine and resvg from either packaged release layout or development layout
const workerCjsPath = fs.existsSync(path.join(rootDir, "app", "worker.cjs"))
  ? path.join(rootDir, "app", "worker.cjs")
  : path.join(rootDir, "dist", "worker.cjs");
const vendorDir = fs.existsSync(path.join(rootDir, "vendor"))
  ? path.join(rootDir, "vendor")
  : path.resolve(rootDir, "..", "vendor");

const engine = requireCjs(workerCjsPath);

let resvgInstance = null;
async function ensureResvg() {
  if (resvgInstance) return resvgInstance;
  const resvgCjsPath = path.join(vendorDir, "resvg.cjs");
  const wasmPath = path.join(vendorDir, "resvg.wasm");
  if (fs.existsSync(resvgCjsPath) && fs.existsSync(wasmPath)) {
    const mod = requireCjs(resvgCjsPath);
    try {
      await mod.initWasm(fs.readFileSync(wasmPath));
    } catch (err) {
      if (!String(err?.message || err).includes("Already initialized")) throw err;
    }
    resvgInstance = mod.Resvg;
    return resvgInstance;
  }
  return null;
}

export const FIGFIG_MCP_PROTOCOL_VERSION = "2024-11-05";

// Parse allowed roots from CLI (--root <dir>) or default to user profile + current workspace
const allowedRoots = [];
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--root" && process.argv[i + 1]) {
    allowedRoots.push(path.resolve(process.argv[i + 1]));
    i++;
  }
}
if (!allowedRoots.length) {
  if (process.env.USERPROFILE) allowedRoots.push(path.resolve(process.env.USERPROFILE));
  allowedRoots.push(path.resolve(process.cwd()));
}

function validateReadOnlyFigPath(filePath) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("必须提供本地 .fig 或 .deck 文件路径 (filePath)。");
  }
  if (filePath.includes("\0")) {
    throw new Error("非法的路径字符。");
  }
  const resolved = path.resolve(filePath);
  const ext = path.extname(resolved).toLowerCase();
  if (ext !== ".fig" && ext !== ".deck") {
    throw new Error("仅支持只读访问 .fig 或 .deck 格式的本地设计文件。");
  }
  const insideAllowed = allowedRoots.some((root) => {
    const normRoot = root.endsWith(path.sep) ? root : root + path.sep;
    return (
      resolved.toLowerCase() === root.toLowerCase() ||
      resolved.toLowerCase().startsWith(normRoot.toLowerCase())
    );
  });
  if (!insideAllowed) {
    throw new Error(`路径不在允许访问的本地目录范围内: ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isFile() || stat.size < 16 || stat.size > 256 * 1024 * 1024) {
    throw new Error("目标文件不存在或超出 256 MiB 安全读取上限。");
  }
  return { resolved, stat };
}

// LRU Cache of parsed documents (max 3 files)
const docCache = new Map();

function loadCachedDocument(filePath) {
  const { resolved, stat } = validateReadOnlyFigPath(filePath);
  const key = resolved.toLowerCase();
  const existing = docCache.get(key);
  if (existing && existing.mtimeMs === stat.mtimeMs && existing.size === stat.size) {
    return existing.doc;
  }
  const bytes = new Uint8Array(fs.readFileSync(resolved));
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const doc = engine.parseDocumentFast(bytes, {
    fileName: path.basename(resolved),
    sha256
  });
  if (docCache.size >= 3) {
    const oldestKey = docCache.keys().next().value;
    docCache.delete(oldestKey);
  }
  docCache.set(key, { doc, mtimeMs: stat.mtimeMs, size: stat.size });
  return doc;
}

function discoverLocalFigFiles() {
  const found = [];
  const seen = new Set();
  const candidateDirs = [];
  if (process.env.USERPROFILE) {
    candidateDirs.push(path.join(process.env.USERPROFILE, "Downloads"));
    candidateDirs.push(path.join(process.env.USERPROFILE, "Desktop"));
  }
  candidateDirs.push(path.join(rootDir, "assets"));
  candidateDirs.push(path.join(rootDir, "app"));
  candidateDirs.push(path.join(rootDir, "dist"));

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (ext !== ".fig" && ext !== ".deck") continue;
        const fullPath = path.resolve(dir, entry.name);
        const key = fullPath.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const stat = fs.statSync(fullPath);
        if (stat.size >= 16) {
          found.push({
            name: entry.name,
            filePath: fullPath,
            byteLength: stat.size,
            modifiedAt: new Date(stat.mtimeMs).toISOString()
          });
        }
      }
    } catch {}
  }
  return found;
}

export const FIGFIG_MCP_TOOLS = [
  {
    name: "figfig_list_local_files",
    description: "扫描本机 Downloads、Desktop 及内置示例目录中的本地 .fig / .deck 设计文件清单。",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "figfig_list_pages",
    description: "只读解析本地 .fig 文件，返回文件摘要（节点总数、内嵌图片数、SHA-256 指纹）及所有页面 (Pages) 列表。",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "本地 .fig 文件的绝对路径" },
        includeInternal: { type: "boolean", description: "是否包含内部 Symbols 组件页（默认 false）" }
      },
      required: ["filePath"]
    }
  },
  {
    name: "figfig_get_frames",
    description: "列出指定页面 (pageId) 下的所有可预览画板 (Frames) 列表，支持分页。",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "本地 .fig 文件的绝对路径" },
        pageId: { type: "string", description: "页面 ID（例如 0:1）" },
        offset: { type: "number", description: "分页起始偏移（默认 0）" },
        limit: { type: "number", description: "单次返回最大条数（默认 100，最大 200）" }
      },
      required: ["filePath", "pageId"]
    }
  },
  {
    name: "figfig_search",
    description: "在本地 .fig 文件中秒级搜索画板名称、图层名称、文本内容及组件覆盖文案。",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "本地 .fig 文件的绝对路径" },
        query: { type: "string", description: "搜索关键词（1~200 字符）" },
        pageId: { type: "string", description: "可选：限定页面 ID" },
        allPages: { type: "boolean", description: "是否跨全部页面搜索（默认 true）" },
        includeInternal: { type: "boolean", description: "是否包含内部组件页（默认 false）" },
        offset: { type: "number", description: "分页偏移（默认 0）" },
        limit: { type: "number", description: "返回条数上限（默认 80）" }
      },
      required: ["filePath", "query"]
    }
  },
  {
    name: "figfig_read_node",
    description: "读取指定节点 (nodeId) 的完整几何尺寸、Auto-Layout 布局、文字内容、填充/描边色值、自动生成的 CSS 代码、组件覆盖及子图层列表。",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "本地 .fig 文件的绝对路径" },
        nodeId: { type: "string", description: "节点 ID（例如 1:21072）" },
        frameId: { type: "string", description: "可选：若读取实例展开后的子节点，可指定所属画板 ID 先展开实例作用域" }
      },
      required: ["filePath", "nodeId"]
    }
  },
  {
    name: "figfig_render_frame",
    description: "使用 FigFig 实例级兼容渲染引擎渲染指定画板或节点 (nodeId)，返回已解析文本清单、热区坐标、SVG 数据及高清 PNG 图像（供多模态模型直接查看界面）。",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "本地 .fig 文件的绝对路径" },
        nodeId: { type: "string", description: "画板或组件节点 ID" },
        format: { type: "string", enum: ["png", "svg", "both"], description: "返回图像格式：png（默认，直接返回多模态 image/png）、svg 或 both" },
        maxDimension: { type: "number", description: "PNG 最大边像素尺寸（默认 1600，范围 200~3200）" }
      },
      required: ["filePath", "nodeId"]
    }
  },
  {
    name: "figfig_compatibility",
    description: "获取本地 .fig 文件的 SHA-256 只读指纹、字形轮廓覆盖率及离线渲染兼容性风险统计。",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "本地 .fig 文件的绝对路径" }
      },
      required: ["filePath"]
    }
  }
];

export function buildMcpClientConfigSnippets({
  serverScriptPath = path.join(rootDir, "mcp", "server.mjs"),
  nodePath = process.execPath
} = {}) {
  const normScript = String(serverScriptPath).replace(/\\/g, "/");
  const normNode = String(nodePath).replace(/\\/g, "/");
  return {
    vscodeMcpJson: JSON.stringify(
      {
        servers: {
          "figfig-design": {
            type: "stdio",
            command: normNode,
            args: [normScript]
          }
        }
      },
      null,
      2
    ),
    claudeDesktopJson: JSON.stringify(
      {
        mcpServers: {
          "figfig-design": {
            command: normNode,
            args: [normScript]
          }
        }
      },
      null,
      2
    )
  };
}

export async function handleFigFigMcpRequest(message) {
  if (!message || typeof message !== "object") {
    return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid JSON-RPC request" } };
  }
  const { id, method, params = {} } = message;

  if (method === "notifications/initialized" || method === "initialized") {
    return null;
  }

  try {
    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: FIGFIG_MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false }
          },
          serverInfo: {
            name: "figfig-mcp-server",
            version: "1.2.0"
          }
        }
      };
    }

    if (method === "ping") {
      return { jsonrpc: "2.0", id, result: {} };
    }

    if (method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: FIGFIG_MCP_TOOLS }
      };
    }

    if (method === "resources/list") {
      const files = discoverLocalFigFiles();
      return {
        jsonrpc: "2.0",
        id,
        result: {
          resources: files.map((f) => ({
            uri: `figfig://file/${encodeURIComponent(f.filePath)}`,
            name: f.name,
            mimeType: "application/json",
            description: `本地 Figma 文件 (${(f.byteLength / (1024 * 1024)).toFixed(2)} MB) · ${f.filePath}`
          }))
        }
      };
    }

    if (method === "resources/read") {
      const uri = String(params.uri || "");
      const filePath = decodeURIComponent(uri.replace(/^figfig:\/\/file\//, ""));
      const doc = loadCachedDocument(filePath);
      const pages = engine.getPagesList(doc, { includeInternal: false });
      return {
        jsonrpc: "2.0",
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  fileName: doc.fileName,
                  sha256: doc.sha256,
                  byteLength: doc.byteLength,
                  nodeCount: doc.nodes.size,
                  imageCount: doc.parsed.images.size,
                  pages
                },
                null,
                2
              )
            }
          ]
        }
      };
    }

    if (method === "tools/call") {
      const toolName = params.name;
      const args = params.arguments || {};

      if (toolName === "figfig_list_local_files") {
        const files = discoverLocalFigFiles();
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify({ total: files.length, files }, null, 2) }]
          }
        };
      }

      if (toolName === "figfig_list_pages") {
        const doc = loadCachedDocument(args.filePath);
        const pages = engine.getPagesList(doc, { includeInternal: Boolean(args.includeInternal) });
        const payload = {
          file: {
            fileName: doc.fileName,
            sha256: doc.sha256,
            byteLength: doc.byteLength,
            nodeCount: doc.nodes.size,
            imageCount: doc.parsed.images.size,
            parseMs: doc.parseMs,
            readOnly: true
          },
          pages
        };
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] }
        };
      }

      if (toolName === "figfig_get_frames") {
        const doc = loadCachedDocument(args.filePath);
        const frames = engine.getFramesOnPage(doc, args.pageId, {
          offset: args.offset,
          limit: args.limit
        });
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(frames, null, 2) }] }
        };
      }

      if (toolName === "figfig_search") {
        const doc = loadCachedDocument(args.filePath);
        const matches = engine.searchNodesFast(doc, args.query, {
          pageId: args.pageId,
          allPages: args.allPages !== false,
          includeInternal: Boolean(args.includeInternal),
          offset: args.offset,
          limit: args.limit || 80
        });
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(matches, null, 2) }] }
        };
      }

      if (toolName === "figfig_read_node") {
        const doc = loadCachedDocument(args.filePath);
        if (args.frameId) {
          engine.renderFrameEnhanced(doc, args.frameId, { rememberScene: true });
        }
        const detail = engine.getNodeDetail(doc, args.nodeId);
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(detail, null, 2) }] }
        };
      }

      if (toolName === "figfig_compatibility") {
        const doc = loadCachedDocument(args.filePath);
        const report = engine.getCompatibilityReport(doc);
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] }
        };
      }

      if (toolName === "figfig_render_frame") {
        const doc = loadCachedDocument(args.filePath);
        const rendered = engine.renderFrameEnhanced(doc, args.nodeId, {
          includeResolvedText: true,
          rememberScene: true
        });
        const format = args.format || "png";
        const content = [];
        const metaSummary = {
          nodeId: rendered.nodeId,
          name: rendered.name,
          width: rendered.width,
          height: rendered.height,
          renderMs: rendered.renderMs,
          visited: rendered.visited,
          outlinedText: rendered.outlinedText,
          fallbackText: rendered.fallbackText,
          resolution: rendered.resolution,
          resolvedTextSample: (rendered.resolvedText || []).slice(0, 80)
        };
        if (format === "svg" || format === "both") {
          metaSummary.svgLength = rendered.svg.length;
        }
        content.push({ type: "text", text: JSON.stringify(metaSummary, null, 2) });

        if (format === "svg" || format === "both") {
          content.push({
            type: "text",
            text: rendered.svg.slice(0, 60000)
          });
        }

        if (format === "png" || format === "both") {
          const ResvgClass = await ensureResvg();
          if (ResvgClass) {
            const maxDim = Math.min(3200, Math.max(200, Number(args.maxDimension) || 1600));
            const factor = Math.min(1, maxDim / rendered.width, maxDim / rendered.height);
            const renderer = new ResvgClass(rendered.svg, {
              fitTo: { mode: "zoom", value: factor },
              font: { loadSystemFonts: false },
              background: "#ffffff"
            });
            const img = renderer.render();
            try {
              const pngBytes = Buffer.from(img.asPng());
              content.push({
                type: "image",
                data: pngBytes.toString("base64"),
                mimeType: "image/png"
              });
            } finally {
              img.free();
              renderer.free();
            }
          }
        }

        return {
          jsonrpc: "2.0",
          id,
          result: { content }
        };
      }

      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Unknown tool: ${toolName}` }
      };
    }

    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` }
    };
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: err instanceof Error ? err.message : String(err)
      }
    };
  }
}

// Run stdio loop when executed directly
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity
  });

  let queue = Promise.resolve();
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    queue = queue.then(async () => {
      try {
        const req = JSON.parse(trimmed);
        const resp = await handleFigFigMcpRequest(req);
        if (resp) {
          process.stdout.write(JSON.stringify(resp) + "\n");
        }
      } catch (err) {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: `Parse error: ${err?.message || String(err)}` }
          }) + "\n"
        );
      }
    });
  });
}
