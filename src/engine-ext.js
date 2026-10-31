// FigFig High-Precision Vector & Lossless Inspection Engine
// Pure isomorphic ES/Worker code (Zero Node.js runtime dependency; works in Web Worker & Node.js)

const MAX_FILE_BYTES = 256 * 1024 * 1024; // 256 MiB desktop limit
const MAX_NODES = 500000;

const _b64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function uint8ToBase64(bytes) {
  let result = "";
  const len = bytes.length;
  let i = 0;
  for (; i + 2 < len; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result +=
      _b64Chars[(n >> 18) & 63] +
      _b64Chars[(n >> 12) & 63] +
      _b64Chars[(n >> 6) & 63] +
      _b64Chars[n & 63];
  }
  if (len - i === 1) {
    const n = bytes[i] << 16;
    result += _b64Chars[(n >> 18) & 63] + _b64Chars[(n >> 12) & 63] + "==";
  } else if (len - i === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    result +=
      _b64Chars[(n >> 18) & 63] +
      _b64Chars[(n >> 12) & 63] +
      _b64Chars[(n >> 6) & 63] +
      "=";
  }
  return result;
}

function toUint8Array(raw) {
  if (!raw) return null;
  if (raw instanceof Uint8Array) return raw;
  if (raw.bytes instanceof Uint8Array) return raw.bytes;
  if (Array.isArray(raw)) return Uint8Array.from(raw);
  if (Array.isArray(raw.bytes)) return Uint8Array.from(raw.bytes);
  const src = raw.bytes && typeof raw.bytes === "object" ? raw.bytes : raw;
  if (typeof src === "object") {
    const keys = Object.keys(src);
    const out = new Uint8Array(keys.length);
    for (let i = 0; i < keys.length; i++) out[i] = src[i] & 0xff;
    return out;
  }
  return null;
}

function inspectImageHeader(bytes) {
  if (!bytes || bytes.length < 24) {
    return { mime: "application/octet-stream", ext: "bin", width: null, height: null };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A + IHDR at offset 16..24
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    return { mime: "image/png", ext: "png", width, height };
  }
  // JPEG: FF D8
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    const len = bytes.length;
    while (offset + 9 < len) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xff) {
        offset++;
        continue;
      }
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (segLen < 2 || offset + 2 + segLen > len) break;
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        return { mime: "image/jpeg", ext: "jpg", width, height };
      }
      offset += 2 + segLen;
    }
    return { mime: "image/jpeg", ext: "jpg", width: null, height: null };
  }
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp", width: null, height: null };
  }
  return { mime: "image/png", ext: "png", width: null, height: null };
}

function f4(v) {
  return Number.isFinite(v) ? Math.round(v * 10000) / 10000 : 0;
}

function f2(v) {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

function multiplyAffine(a, b) {
  // [ a.m00 a.m01 a.m02 ]   [ b.m00 b.m01 b.m02 ]
  // [ a.m10 a.m11 a.m12 ] * [ b.m10 b.m11 b.m12 ]
  // [   0     0     1   ]   [   0     0     1   ]
  return {
    m00: a.m00 * b.m00 + a.m01 * b.m10,
    m01: a.m00 * b.m01 + a.m01 * b.m11,
    m02: a.m00 * b.m02 + a.m01 * b.m12 + a.m02,
    m10: a.m10 * b.m00 + a.m11 * b.m10,
    m11: a.m10 * b.m01 + a.m11 * b.m11,
    m12: a.m10 * b.m02 + a.m11 * b.m12 + a.m12
  };
}

function transformBBox(mat, w, h) {
  const pts = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h }
  ];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    const tx = mat.m00 * p.x + mat.m01 * p.y + mat.m02;
    const ty = mat.m10 * p.x + mat.m11 * p.y + mat.m12;
    if (tx < minX) minX = tx;
    if (ty < minY) minY = ty;
    if (tx > maxX) maxX = tx;
    if (ty > maxY) maxY = ty;
  }
  return {
    x: f2(minX),
    y: f2(minY),
    w: f2(Math.max(0, maxX - minX)),
    h: f2(Math.max(0, maxY - minY))
  };
}

function parseDocumentFast(bytes, metaInfo = {}) {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!(bytes instanceof Uint8Array) || bytes.length < 16) {
    throw new Error("文件为空或已损坏（少于 16 字节）。");
  }
  if (bytes.length > MAX_FILE_BYTES) {
    throw new Error("文件超过 256 MiB 安全读取上限。");
  }
  const signature = new TextDecoder().decode(bytes.subarray(0, 8));
  let parsed;
  if (bytes[0] === 80 && bytes[1] === 75) {
    let expandedBytes = 0;
    let entries = 0;
    unzipSync(bytes, {
      filter(entry) {
        entries += 1;
        expandedBytes += entry.originalSize;
        if (entries > 50000 || expandedBytes > 1536 * 1024 * 1024) {
          throw new Error("压缩包展开体积超过安全上限。");
        }
        if (entry.name.includes("..") || entry.name.startsWith("/") || entry.name.includes("\\")) {
          throw new Error("检测到不安全的归档路径条目。");
        }
        return false;
      }
    });
    parsed = parseFig(bytes);
  } else if (signature.startsWith("fig-")) {
    parsed = parseFigBinary(bytes);
  } else {
    throw new Error("不是受支持的 Figma (.fig / .deck / fig-kiwi) 文件。");
  }
  if (!Array.isArray(parsed.nodes) || parsed.nodes.length > MAX_NODES) {
    throw new Error("文件节点数异常或超过 500,000 上限。");
  }

  const nodes = new Map();
  for (const node of parsed.nodes) {
    const id = nodeId(node);
    if (id && node.phase !== "REMOVED") {
      nodes.set(id, node);
    }
  }

  const children = new Map();
  const parentMap = new Map();
  for (const [id, node] of nodes.entries()) {
    const parent = node.parentIndex?.guid;
    if (!parent) continue;
    const pid = `${parent.sessionID}:${parent.localID}`;
    parentMap.set(id, pid);
    if (!children.has(pid)) children.set(pid, []);
    children.get(pid).push(node);
  }

  for (const siblings of children.values()) {
    siblings.sort((left, right) => {
      const first = left.parentIndex?.position ?? "";
      const second = right.parentIndex?.position ?? "";
      return first < second ? -1 : first > second ? 1 : 0;
    });
  }

  const pages = [...nodes.values()].filter((node) => node.type === "CANVAS");
  const componentDefinitions = new Map();
  const slotOwnerMap = new Map();
  for (const [id, node] of nodes.entries()) {
    for (const definition of node.componentPropDefs || []) {
      const key = `${definition.id.sessionID}:${definition.id.localID}`;
      if (!componentDefinitions.has(key) || definition.varValue) componentDefinitions.set(key, definition);
    }
    for (const owner of [node, ...(node.symbolData?.symbolOverrides || [])]) {
      for (const assignment of owner.componentPropAssignments || []) {
        const slotGuid = assignment.varValue?.value?.slotContentIdValue?.guid || assignment.value?.slotContentIdValue?.guid;
        if (slotGuid) {
          const slotId = `${slotGuid.sessionID}:${slotGuid.localID}`;
          if (!slotOwnerMap.has(slotId)) slotOwnerMap.set(slotId, id);
        }
      }
    }
  }
  const imageAssets = [];
  for (const [hash, imgBytes] of parsed.images.entries()) {
    const info = inspectImageHeader(imgBytes);
    imageAssets.push({
      hash,
      byteLength: imgBytes.byteLength,
      mime: info.mime,
      ext: info.ext,
      width: info.width,
      height: info.height
    });
  }

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const parseMs = Math.max(1, Math.round(t1 - t0));

  return {
    parsed,
    nodes,
    children,
    parentMap,
    slotOwnerMap,
    componentDefinitions,
    pages,
    imageAssets,
    byteLength: bytes.byteLength,
    sha256: metaInfo.sha256 || "",
    fileName: metaInfo.fileName || parsed.meta?.file_name || "Untitled.fig",
    parseMs
  };
}

function summarizeNodeFast(doc, node) {
  const id = nodeId(node);
  return {
    id,
    name: node.name ?? "",
    type: node.type,
    visible: node.visible !== false,
    size: node.size ? { x: f2(node.size.x), y: f2(node.size.y) } : null,
    text: node.textData?.characters ?? null,
    childCount: doc.children.get(id)?.length ?? 0
  };
}

function logicalParentId(doc, curId) {
  if (doc.slotOwnerMap?.has(curId)) return doc.slotOwnerMap.get(curId);
  return doc.parentMap.get(curId);
}

function pageOfNode(doc, idOrNode) {
  let curId = typeof idOrNode === "string" ? idOrNode : nodeId(idOrNode);
  const seen = new Set();
  while (curId && !seen.has(curId)) {
    seen.add(curId);
    const n = doc.nodes.get(curId);
    if (!n) return null;
    if (n.type === "CANVAS") return n;
    curId = logicalParentId(doc, curId);
  }
  return null;
}

function isPreviewableBoardNode(node) {
  if (!node || node.visible === false || node.isSlotContent === true) return false;
  const w = node.size?.x ?? 0;
  const h = node.size?.y ?? 0;
  return (
    ["FRAME", "INSTANCE", "SYMBOL", "SECTION", "COMPONENT"].includes(node.type) &&
    w >= 120 &&
    w <= 20000 &&
    h >= 80 &&
    h <= 30000
  );
}

function findEnclosingBoardId(doc, targetId) {
  let curId = targetId;
  let lastValidBoard = null;
  const seen = new Set();
  while (curId && !seen.has(curId)) {
    seen.add(curId);
    const node = doc.nodes.get(curId);
    if (!node) break;
    if (node.type === "CANVAS") break;
    const pid = logicalParentId(doc, curId);
    const parentNode = pid ? doc.nodes.get(pid) : null;
    if (isPreviewableBoardNode(node)) {
      lastValidBoard = curId;
      if (parentNode && (parentNode.type === "CANVAS" || parentNode.type === "SECTION")) {
        return curId;
      }
    }
    curId = pid;
  }
  return lastValidBoard || targetId;
}

function getBreadcrumbsForNode(doc, targetId) {
  const trail = [];
  let curId = targetId;
  const seen = new Set();
  while (curId && !seen.has(curId)) {
    seen.add(curId);
    const node = doc.nodes.get(curId);
    if (!node) break;
    if (node.type === "DOCUMENT") break;
    trail.push({
      id: curId,
      name: node.name || node.type,
      type: node.type
    });
    curId = logicalParentId(doc, curId);
  }
  return trail.reverse();
}

function getDocumentSummary(doc) {
  return {
    fileName: doc.fileName,
    sha256: doc.sha256,
    byteLength: doc.byteLength,
    formatVersion: doc.parsed.header.version,
    prelude: doc.parsed.header.prelude,
    nodeCount: doc.nodes.size,
    imageCount: doc.parsed.images.size,
    pageCount: doc.pages.length,
    parseMs: doc.parseMs,
    readOnly: true,
    hasThumbnail: Boolean(doc.parsed.thumbnail),
    pages: doc.pages.map((p) => ({
      ...summarizeNodeFast(doc, p),
      internalOnly: p.internalOnly === true
    }))
  };
}

function getPagesList(doc, options = {}) {
  return getDocumentSummary(doc).pages.filter(
    (p) => options.includeInternal || !p.internalOnly
  );
}

function paginateItems(items, options = {}) {
  const offset = Number.isInteger(options.offset) ? Math.max(0, options.offset) : 0;
  const limit = Number.isInteger(options.limit) ? Math.min(500, Math.max(1, options.limit)) : 120;
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    offset,
    nextOffset: offset + limit < items.length ? offset + limit : null
  };
}

function getFramesOnPage(doc, pageId, options = {}) {
  const page = doc.nodes.get(pageId);
  if (!page || page.type !== "CANVAS") throw new Error("需要有效的页面 ID。");
  const result = [];
  const topChildren = doc.children.get(pageId) ?? [];
  const pending = [...topChildren].reverse();
  const seen = new Set();
  while (pending.length) {
    const node = pending.pop();
    const id = nodeId(node);
    if (!id || seen.has(id) || node.visible === false) continue;
    seen.add(id);
    const width = node.size?.x ?? 0;
    const height = node.size?.y ?? 0;
    const isBoard =
      ["FRAME", "INSTANCE", "SYMBOL", "COMPONENT"].includes(node.type) &&
      width >= 200 &&
      width <= 12000 &&
      height >= 100 &&
      height <= 30000;
    if (isBoard) {
      result.push(summarizeNodeFast(doc, node));
    } else {
      const sub = doc.children.get(id) ?? [];
      for (let i = sub.length - 1; i >= 0; i--) pending.push(sub[i]);
    }
  }
  // Fallback: if a page only has smaller components/icons/groups, list direct drawable children
  if (!result.length) {
    for (const child of topChildren) {
      if (child.visible === false) continue;
      if ((child.size?.x ?? 0) > 0 && (child.size?.y ?? 0) > 0) {
        result.push(summarizeNodeFast(doc, child));
      }
    }
  }
  return paginateItems(result, options);
}

function getChildrenOfNode(doc, id, options = {}) {
  const scene = doc.renderScene?.nodes.has(id) ? doc.renderScene : doc;
  if (!scene.nodes.has(id)) throw new Error("未找到指定节点。");
  const list = (scene.children.get(id) ?? []).map((n) => summarizeNodeFast(scene, n));
  return paginateItems(list, options);
}

function colorToHexAndRgba(colorObj, opacity = 1) {
  if (!colorObj) return { hex: "#000000", rgba: "rgba(0, 0, 0, 1)", alpha: 100 };
  const r = Math.max(0, Math.min(255, Math.round((colorObj.r ?? 0) * 255)));
  const g = Math.max(0, Math.min(255, Math.round((colorObj.g ?? 0) * 255)));
  const b = Math.max(0, Math.min(255, Math.round((colorObj.b ?? 0) * 255)));
  const a = Math.max(0, Math.min(1, (colorObj.a ?? 1) * (opacity ?? 1)));
  const hex =
    "#" +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  return {
    hex,
    rgba: `rgba(${r}, ${g}, ${b}, ${f2(a)})`,
    alpha: Math.round(a * 100)
  };
}

function generateCssForNode(node) {
  const lines = [];
  const nameComment = (node.name || node.type || "layer").replace(/\*\//g, "");
  lines.push(`/* ${nameComment} (${node.type}) */`);
  if (node.size?.x !== undefined && node.size?.y !== undefined) {
    lines.push(`width: ${f2(node.size.x)}px;`);
    lines.push(`height: ${f2(node.size.y)}px;`);
  }
  if (node.opacity !== undefined && node.opacity < 1) {
    lines.push(`opacity: ${f2(node.opacity)};`);
  }
  // Auto-layout
  if (node.stackMode === "HORIZONTAL" || node.stackMode === "VERTICAL") {
    lines.push(`display: flex;`);
    lines.push(`flex-direction: ${node.stackMode === "HORIZONTAL" ? "row" : "column"};`);
    if (node.stackSpacing) lines.push(`gap: ${f2(node.stackSpacing)}px;`);
    const pt = f2(node.stackVerticalPadding ?? 0);
    const pr = f2(node.stackPaddingRight ?? node.stackHorizontalPadding ?? 0);
    const pb = f2(node.stackPaddingBottom ?? node.stackVerticalPadding ?? 0);
    const pl = f2(node.stackHorizontalPadding ?? 0);
    if (pt || pr || pb || pl) {
      lines.push(`padding: ${pt}px ${pr}px ${pb}px ${pl}px;`);
    }
  }
  // Border radius
  if (node.rectangleCornerRadiiIndependent) {
    const tl = f2(node.rectangleTopLeftCornerRadius ?? 0);
    const tr = f2(node.rectangleTopRightCornerRadius ?? 0);
    const br = f2(node.rectangleBottomRightCornerRadius ?? 0);
    const bl = f2(node.rectangleBottomLeftCornerRadius ?? 0);
    lines.push(`border-radius: ${tl}px ${tr}px ${br}px ${bl}px;`);
  } else if (node.cornerRadius) {
    lines.push(`border-radius: ${f2(node.cornerRadius)}px;`);
  }
  // Fills
  const fills = (node.fillPaints ?? []).filter((p) => p.visible !== false);
  for (const paint of fills) {
    if (paint.type === "SOLID" && paint.color) {
      const c = colorToHexAndRgba(paint.color, paint.opacity ?? 1);
      if (node.type === "TEXT") {
        lines.push(`color: ${c.alpha === 100 ? c.hex : c.rgba};`);
      } else {
        lines.push(`background: ${c.alpha === 100 ? c.hex : c.rgba};`);
      }
    } else if (paint.type === "GRADIENT_LINEAR" && Array.isArray(paint.stops)) {
      const stops = paint.stops
        .map((s) => {
          const c = colorToHexAndRgba(s.color, paint.opacity ?? 1);
          return `${c.alpha === 100 ? c.hex : c.rgba} ${Math.round((s.position ?? 0) * 100)}%`;
        })
        .join(", ");
      lines.push(`background: linear-gradient(135deg, ${stops});`);
    }
  }
  // Strokes
  const strokes = (node.strokePaints ?? []).filter((p) => p.visible !== false && p.type === "SOLID");
  if (strokes.length && (node.strokeWeight ?? 0) > 0) {
    const sc = colorToHexAndRgba(strokes[0].color, strokes[0].opacity ?? 1);
    lines.push(`border: ${f2(node.strokeWeight)}px solid ${sc.alpha === 100 ? sc.hex : sc.rgba};`);
  }
  // Drop shadows
  const shadows = (node.effects ?? []).filter(
    (e) => e.visible !== false && (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW")
  );
  if (shadows.length) {
    const shList = shadows.map((s) => {
      const sc = colorToHexAndRgba(s.color, 1);
      const inset = s.type === "INNER_SHADOW" ? "inset " : "";
      return `${inset}${f2(s.offset?.x ?? 0)}px ${f2(s.offset?.y ?? 0)}px ${f2(s.radius ?? 0)}px ${sc.rgba}`;
    });
    lines.push(`box-shadow: ${shList.join(", ")};`);
  }
  // Typography
  if (node.type === "TEXT" || node.fontName || node.fontSize) {
    if (node.fontName?.family) {
      lines.push(`font-family: "${node.fontName.family}", sans-serif;`);
    }
    if (node.fontSize) {
      lines.push(`font-size: ${f2(node.fontSize)}px;`);
    }
    if (node.fontName?.style) {
      const st = node.fontName.style;
      const weight = /black/i.test(st)
        ? 900
        : /extrabold|heavy/i.test(st)
        ? 800
        : /bold/i.test(st) && !/semi/i.test(st)
        ? 700
        : /semibold|demibold/i.test(st)
        ? 600
        : /medium/i.test(st)
        ? 500
        : /light/i.test(st)
        ? 300
        : 400;
      lines.push(`font-weight: ${weight};`);
      if (/italic/i.test(st)) lines.push(`font-style: italic;`);
    }
    if (node.lineHeight?.value) {
      if (node.lineHeight.units === "PIXELS") {
        lines.push(`line-height: ${f2(node.lineHeight.value)}px;`);
      } else if (node.lineHeight.units === "PERCENT") {
        lines.push(`line-height: ${f2(node.lineHeight.value)}%;`);
      }
    }
    if (node.textAlignHorizontal) {
      lines.push(`text-align: ${node.textAlignHorizontal.toLowerCase()};`);
    }
  }
  return lines.join("\n");
}

function sanitizeForJson(value) {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Uint8Array) return Array.from(value);
  if (Array.isArray(value)) return value.map(sanitizeForJson);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeForJson(v);
    return out;
  }
  return value;
}

function getNodeDetail(doc, id, options = {}) {
  let resolvedId = id;
  let scene = doc.renderScene?.nodes.has(id) ? doc.renderScene : null;
  if (!scene && doc.renderScene) {
    for (const [sId, sNode] of doc.renderScene.nodes.entries()) {
      if (sNode.originalNodeId === id) {
        scene = doc.renderScene;
        resolvedId = sId;
        break;
      }
    }
  }
  const source = scene || doc;
  const node = source.nodes.get(resolvedId);
  if (!node) throw new Error("未找到节点：" + id);
  const parentId = source.parentMap.get(resolvedId) ?? null;
  const pageNode = pageOfNode(doc, scene ? scene.frameId : node);
  const enclosingFrameId = scene ? scene.frameId : findEnclosingBoardId(doc, id);
  const symbol = node.symbolData?.symbolID;
  const properties = {};
  for (const key of [
    "transform",
    "opacity",
    "fillPaints",
    "strokePaints",
    "strokeWeight",
    "strokeAlign",
    "cornerRadius",
    "rectangleCornerRadiiIndependent",
    "rectangleTopLeftCornerRadius",
    "rectangleTopRightCornerRadius",
    "rectangleBottomLeftCornerRadius",
    "rectangleBottomRightCornerRadius",
    "fontName",
    "fontSize",
    "lineHeight",
    "letterSpacing",
    "textAlignHorizontal",
    "textAlignVertical",
    "stackMode",
    "stackSpacing",
    "stackHorizontalPadding",
    "stackVerticalPadding",
    "stackPaddingRight",
    "stackPaddingBottom",
    "stackPrimaryAlignItems",
    "stackCounterAlignItems",
    "stackPrimarySizing",
    "stackCounterSizing",
    "frameMaskDisabled",
    "effects",
    "blendMode"
  ]) {
    if (node[key] !== undefined) properties[key] = node[key];
  }

  const overrides = (node.symbolData?.symbolOverrides ?? []).map((ov) => ({
    path: ov.guidPath?.guids?.map((g) => `${g.sessionID}:${g.localID}`) ?? [],
    text: ov.textData?.characters ?? null,
    visible: ov.visible,
    fills: ov.fillPaints,
    symbolId: ov.overriddenSymbolID
      ? `${ov.overriddenSymbolID.sessionID}:${ov.overriddenSymbolID.localID}`
      : null
  }));

  const parsedFills = (node.fillPaints ?? [])
    .filter((p) => p.visible !== false)
    .map((p) => {
      if (p.type === "SOLID" && p.color) {
        return {
          type: "SOLID",
          ...colorToHexAndRgba(p.color, p.opacity ?? 1)
        };
      }
      if (p.type === "IMAGE") {
        const hashBytes = p.image?.hash;
        const hash = hashBytes?.length ? hashToHex(hashBytes) : p.image?.name;
        return {
          type: "IMAGE",
          imageHash: hash || null,
          scaleMode: p.imageScaleMode ?? "FILL",
          opacity: Math.round((p.opacity ?? 1) * 100)
        };
      }
      if (p.type === "GRADIENT_LINEAR" || p.type === "GRADIENT_RADIAL") {
        return {
          type: p.type,
          stops: (p.stops ?? []).map((s) => ({
            position: Math.round((s.position ?? 0) * 100),
            ...colorToHexAndRgba(s.color, p.opacity ?? 1)
          }))
        };
      }
      return { type: p.type };
    });

  const parsedStrokes = (node.strokePaints ?? [])
    .filter((p) => p.visible !== false && p.type === "SOLID" && p.color)
    .map((p) => ({
      weight: f2(node.strokeWeight ?? 1),
      align: node.strokeAlign ?? "CENTER",
      ...colorToHexAndRgba(p.color, p.opacity ?? 1)
    }));

  return {
    ...summarizeNodeFast(source, node),
    id,
    parentId,
    pageId: pageNode ? nodeId(pageNode) : null,
    pageName: pageNode?.name ?? "",
    enclosingFrameId,
    sourceNodeId: node.originalNodeId || id,
    instancePath: node.instancePath || [],
    breadcrumbs: getBreadcrumbsForNode(source, resolvedId),
    componentId: symbol ? `${symbol.sessionID}:${symbol.localID}` : null,
    properties: sanitizeForJson(properties),
    parsedFills,
    parsedStrokes,
    cssCode: generateCssForNode(node),
    overrides: paginateItems(sanitizeForJson(overrides), options),
    cachedGlyphs: node.derivedTextData?.glyphs?.length ?? 0,
    cachedInstanceLayoutEntries: node.derivedSymbolData?.length ?? 0,
    interactions: (node.prototypeInteractions ?? []).length,
    children: getChildrenOfNode(doc, resolvedId, options)
  };
}

function extractNodeAssignedTexts(node) {
  const parts = [];
  const collectAssignments = (assignments) => {
    for (const a of assignments || []) {
      const t =
        a.varValue?.value?.textDataValue?.characters ??
        a.varValue?.value?.textValue ??
        a.value?.textDataValue?.characters ??
        a.value?.textValue;
      if (typeof t === "string" && t) parts.push(t);
    }
  };
  collectAssignments(node.componentPropAssignments);
  for (const ov of node.symbolData?.symbolOverrides ?? []) {
    if (ov.textData?.characters) parts.push(ov.textData.characters);
    collectAssignments(ov.componentPropAssignments);
  }
  return parts.join("\n");
}

function searchNodesFast(doc, query, options = {}) {
  if (typeof query !== "string" || !query.trim() || query.length > 200) {
    throw new Error("搜索词长度需在 1~200 个字符之间。");
  }
  const needle = query.trim().toLocaleLowerCase();
  const scopeAllPages = options.allPages === true;
  const matches = [];
  for (const [id, node] of doc.nodes.entries()) {
    if (node.type === "DOCUMENT" || node.type === "CANVAS") continue;
    const text = node.textData?.characters ?? "";
    const overrideText = extractNodeAssignedTexts(node);
    const nameStr = node.name ?? "";
    if (
      !nameStr.toLocaleLowerCase().includes(needle) &&
      !text.toLocaleLowerCase().includes(needle) &&
      !overrideText.toLocaleLowerCase().includes(needle)
    ) {
      continue;
    }
    const page = pageOfNode(doc, node);
    const pId = page ? nodeId(page) : null;
    if (!scopeAllPages && options.pageId && pId !== options.pageId) continue;
    if (!options.includeInternal && page?.internalOnly) continue;
    const frameId = findEnclosingBoardId(doc, id);
    const frameNode = frameId ? doc.nodes.get(frameId) : null;
    matches.push({
      ...summarizeNodeFast(doc, node),
      pageId: pId,
      pageName: page?.name ?? "",
      frameId,
      frameName: frameNode?.name ?? "",
      text: (text || overrideText).slice(0, 400),
      overrideText: overrideText.slice(0, 400)
    });
  }
  return paginateItems(matches, options);
}

function getCompatibilityReport(doc) {
  const types = {};
  const fonts = new Set();
  const risks = new Map();
  let totalGlyphOutlines = 0;
  let totalTextNodes = 0;
  const add = (code, id) => {
    const entry = risks.get(code) ?? { code, count: 0, examples: [] };
    entry.count += 1;
    if (entry.examples.length < 5) entry.examples.push(id);
    risks.set(code, entry);
  };
  for (const [id, node] of doc.nodes.entries()) {
    types[node.type] = (types[node.type] ?? 0) + 1;
    if (node.fontName?.family) fonts.add(node.fontName.family);
    if (node.type === "TEXT") {
      totalTextNodes += 1;
      if (node.derivedTextData?.glyphs?.length) {
        totalGlyphOutlines += 1;
      } else {
        add("FONT_FALLBACK", id);
      }
    }
    if (["BRUSH", "WIDGET", "VIDEO", "EMBED"].includes(node.type)) add("UNSUPPORTED_NODE", id);
    if (node.mask && node.maskType && !["ALPHA", "VECTOR", "OUTLINE", "LUMINANCE"].includes(node.maskType)) add("MASK_SEMANTICS", id);
    if (
      node.effects?.some(
        (effect) =>
          effect.visible !== false &&
          effect.type !== "DROP_SHADOW"
      )
    ) {
      add("EFFECT_APPROXIMATION", id);
    }
    if (node.blendMode && !["NORMAL", "PASS_THROUGH"].includes(node.blendMode)) {
      add("BLEND_MODE", id);
    }
    if (
      node.fillPaints?.some(
        (paint) => paint.visible !== false && ["VIDEO", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"].includes(paint.type)
      )
    ) {
      add("UNSUPPORTED_FILL", id);
    }
    if (node.prototypeInteractions?.length) add("STATIC_INTERACTIONS", id);
  }
  return {
    renderer: "FigFig instance-scoped compatible renderer",
    readOnly: true,
    visualFidelity: "not-certified-lossless",
    currentFrameResolution: doc.renderScene?.diagnostics || null,
    sha256: doc.sha256,
    byteLength: doc.byteLength,
    parseMs: doc.parseMs,
    totalTextNodes,
    totalGlyphOutlines,
    fonts: [...fonts].sort(),
    types,
    warnings: [...risks.values()]
  };
}

// ============================================================================
// High-Precision Vector SVG & Interactive Hit-Map Renderer
// ============================================================================

function independentRoundedRectPath(x, y, w, h, radii) {
  let [tl, tr, br, bl] = radii.map((r) => Math.max(0, r || 0));
  const maxR = Math.min(w, h) / 2;
  tl = Math.min(tl, maxR);
  tr = Math.min(tr, maxR);
  br = Math.min(br, maxR);
  bl = Math.min(bl, maxR);
  return [
    `M${f4(x + tl)} ${f4(y)}`,
    `H${f4(x + w - tr)}`,
    tr > 0 ? `A${f4(tr)} ${f4(tr)} 0 0 1 ${f4(x + w)} ${f4(y + tr)}` : "",
    `V${f4(y + h - br)}`,
    br > 0 ? `A${f4(br)} ${f4(br)} 0 0 1 ${f4(x + w - br)} ${f4(y + h)}` : "",
    `H${f4(x + bl)}`,
    bl > 0 ? `A${f4(bl)} ${f4(bl)} 0 0 1 ${f4(x)} ${f4(y + h - bl)}` : "",
    `V${f4(y + tl)}`,
    tl > 0 ? `A${f4(tl)} ${f4(tl)} 0 0 1 ${f4(x + tl)} ${f4(y)}` : "",
    "Z"
  ]
    .filter(Boolean)
    .join(" ");
}

function getNodeRadii(node) {
  if (
    node.rectangleCornerRadiiIndependent ||
    node.rectangleTopLeftCornerRadius !== undefined ||
    node.rectangleTopRightCornerRadius !== undefined ||
    node.rectangleBottomRightCornerRadius !== undefined ||
    node.rectangleBottomLeftCornerRadius !== undefined
  ) {
    const fallback = node.cornerRadius ?? 0;
    const tl = node.rectangleTopLeftCornerRadius ?? fallback;
    const tr = node.rectangleTopRightCornerRadius ?? fallback;
    const br = node.rectangleBottomRightCornerRadius ?? fallback;
    const bl = node.rectangleBottomLeftCornerRadius ?? fallback;
    if (tl !== tr || tl !== br || tl !== bl) {
      return { independent: true, radii: [tl, tr, br, bl], uniform: tl };
    }
    return { independent: false, radii: [tl, tr, br, bl], uniform: tl };
  }
  const r = node.cornerRadius ?? 0;
  return { independent: false, radii: [r, r, r, r], uniform: r };
}

function decodeCmdBlobFast(blobs, blobIdx) {
  if (blobIdx == null || !blobs?.[blobIdx]) return null;
  const bytes = toUint8Array(blobs[blobIdx]);
  if (!bytes || !bytes.length) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const commands = [];
  const verbs = ["Z", "M", "L", "Q", "C"];
  const coordinateCounts = [0, 2, 2, 4, 6];
  let offset = 0;
  while (offset < bytes.length) {
    const opcode = bytes[offset++];
    const count = coordinateCounts[opcode];
    if (count === undefined) throw new Error(`Unsupported path opcode ${opcode} in blob ${blobIdx}.`);
    if (offset + count * 4 > bytes.length) throw new Error(`Truncated path in blob ${blobIdx}.`);
    const coordinates = [];
    for (let coordinate = 0; coordinate < count; coordinate += 1) {
      const value = view.getFloat32(offset, true);
      if (!Number.isFinite(value)) throw new Error(`Invalid path coordinate in blob ${blobIdx}.`);
      coordinates.push(String(value));
      offset += 4;
    }
    commands.push(verbs[opcode] + coordinates.join(" "));
  }
  return commands.length ? commands.join("") : null;
}

function renderGlyphOutlinesFast(doc, node, counts) {
  const chars = node.textData?.characters ?? "";
  const baselines = node.derivedTextData?.baselines;
  const glyphs = node.derivedTextData?.glyphs;
  if (!glyphs?.length || isStaleLayout(chars, baselines, glyphs)) {
    counts.fallbackText += 1;
    return null;
  }
  const spans = [];
  for (const glyph of glyphs) {
    const blob = getBlobBytes(doc.parsed, glyph.commandsBlob);
    if (!blob) {
      counts.fallbackText += 1;
      return null;
    }
    let path;
    try {
      path = decodeCmdBlobFast(doc.parsed.message.blobs, glyph.commandsBlob)?.replace(/^Z+/, "");
    } catch {
      counts.fallbackText += 1;
      return null;
    }
    if (!path) {
      counts.emptyGlyphs += 1;
      continue;
    }
    const styleId = node.textData?.characterStyleIDs?.[glyph.firstCharacter];
    const style = node.textData?.styleOverrideTable?.find((entry) => entry.styleID === styleId);
    const size2 = glyph.fontSize ?? node.fontSize ?? 14;
    const position = glyph.position ?? { x: 0, y: 0 };
    const fillPaint = (style?.fillPaints ?? node.fillPaints)?.find(
      (entry) => entry.visible !== false && entry.type === "SOLID"
    );
    const fillColor = fillPaint ? cssColor(fillPaint.color ?? {}, fillPaint.opacity ?? 1) : "#202326";
    spans.push(
      `<g transform="translate(${f4(position.x)},${f4(position.y)}) rotate(${f4(
        ((glyph.rotation ?? 0) * 180) / Math.PI
      )}) scale(${f4(size2)},${f4(-size2)})"><path d="${path}" fill="${fillColor}"/></g>`
    );
  }
  const baseFillPaint = node.fillPaints?.find(
    (entry) => entry.visible !== false && entry.type === "SOLID"
  );
  const baseColor = baseFillPaint
    ? cssColor(baseFillPaint.color ?? {}, baseFillPaint.opacity ?? 1)
    : "#202326";
  for (const decoration of node.derivedTextData?.decorations ?? []) {
    for (const rect of decoration.rects ?? []) {
      spans.push(
        `<rect x="${f4(rect.x)}" y="${f4(rect.y)}" width="${f4(rect.w)}" height="${f4(
          rect.h
        )}" fill="${baseColor}"/>`
      );
    }
  }
  counts.outlinedText += 1;
  const transform = node.transform ?? {};
  return `<g transform="matrix(${f4(transform.m00 ?? 1)},${f4(transform.m10 ?? 0)},${f4(
    transform.m01 ?? 0
  )},${f4(transform.m11 ?? 1)},${f4(transform.m02 ?? 0)},${f4(transform.m12 ?? 0)})">${spans.join(
    ""
  )}</g>`;
}

function frameStrokeSvgFast(node, width, height, radius, stroke) {
  const radiiInfo = getNodeRadii(node);
  if (!node.borderStrokeWeightsIndependent) {
    if (radiiInfo.independent && stroke) {
      const pathD = independentRoundedRectPath(0, 0, width, height, radiiInfo.radii);
      return `<path d="${pathD}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.width}"/>`;
    }
    return rectStrokeSvg(0, 0, width, height, radius, stroke);
  }
  const color = resolveFill(node.strokePaints);
  if (!color) return "";
  const weights = [node.borderTopWeight, node.borderRightWeight, node.borderBottomWeight, node.borderLeftWeight].map((value) => Math.max(0, value ?? 0));
  const align = node.strokeAlign ?? "CENTER";
  if (weights.every((value) => value === weights[0])) return weights[0] ? rectStrokeSvg(0, 0, width, height, radius, { color, width: weights[0], align }) : "";
  return weights.map((weight, index) => {
    if (!weight) return "";
    const inset = align === "INSIDE" ? weight / 2 : align === "OUTSIDE" ? -weight / 2 : 0;
    if (!radius && !radiiInfo.independent) {
      const paths = [`M0 ${inset}H${width}`, `M${width - inset} 0V${height}`, `M0 ${height - inset}H${width}`, `M${inset} 0V${height}`];
      return `<path d="${paths[index]}" fill="none" stroke="${color}" stroke-width="${weight}"/>`;
    }
    const outside = align === "INSIDE" ? 0 : Math.max(...weights);
    const corners = [[-outside, -outside], [width + outside, -outside], [width + outside, height + outside], [-outside, height + outside]];
    const polygon = [corners[index], corners[(index + 1) % 4], [width / 2, height / 2]].map((point) => point.join(",")).join(" ");
    const clipId = `border-side-${++_svgIdSeq}`;
    const baseStroke = radiiInfo.independent
      ? `<path d="${independentRoundedRectPath(0, 0, width, height, radiiInfo.radii)}" fill="none" stroke="${color}" stroke-width="${weight}"/>`
      : rectStrokeSvg(0, 0, width, height, radius, { color, width: weight, align });
    return `<defs><clipPath id="${clipId}"><polygon points="${polygon}"/></clipPath></defs><g clip-path="url(#${clipId})">${baseStroke}</g>`;
  }).join("");
}

function resolvePaintColorOrGradientFast(paints, w, h) {
  if (!paints?.length) return null;
  const visible = paints.filter((p) => p.visible !== false);
  for (const p of visible) {
    if (p.type === "SOLID" && p.color) {
      return { paint: cssColor(p.color, p.opacity ?? 1), defs: "", opacityAttr: "" };
    }
    if (p.type === "GRADIENT_LINEAR" || p.type === "GRADIENT_RADIAL") {
      const grad = resolveGradientSvg(p, Math.max(1, w || 1), Math.max(1, h || 1));
      if (grad) return { paint: grad.fill, defs: grad.defs, opacityAttr: grad.opacityAttr || "" };
      if (p.stops?.[0]?.color) {
        return { paint: cssColor(p.stops[0].color, p.opacity ?? 1), defs: "", opacityAttr: "" };
      }
    }
    if ((p.type === "GRADIENT_ANGULAR" || p.type === "GRADIENT_DIAMOND") && p.stops?.[0]?.color) {
      return { paint: cssColor(p.stops[0].color, p.opacity ?? 1), defs: "", opacityAttr: "" };
    }
  }
  return null;
}

function renderVectorFast(deck, node) {
  const t = node.transform ?? {};
  const m00 = t.m00 ?? 1, m01 = t.m01 ?? 0, m02 = t.m02 ?? 0;
  const m10 = t.m10 ?? 0, m11 = t.m11 ?? 1, m12 = t.m12 ?? 0;
  const { w, h } = size(node);
  const blobs = deck.message?.blobs;
  const parts = [];
  let defs = "";
  const baseFill = resolvePaintColorOrGradientFast(getFillPaints(node), w, h);
  if (baseFill?.defs) defs = appendDefs(defs, baseFill.defs);
  const fillColor = baseFill?.paint ?? null;
  const fillOpacityAttr = baseFill?.opacityAttr ?? "";
  const fillEntries = [];
  if (node.fillGeometry?.length && blobs) {
    const styleMap = new Map();
    if (node.vectorData?.styleOverrideTable?.length) {
      for (const s of node.vectorData.styleOverrideTable) {
        if (s.styleID != null && s.fillPaints) {
          const resolved = resolvePaintColorOrGradientFast(s.fillPaints, w, h);
          if (resolved?.defs) defs = appendDefs(defs, resolved.defs);
          styleMap.set(s.styleID, resolved);
        }
      }
    }
    for (const geo of node.fillGeometry) {
      const stylePaint = geo.styleID && styleMap.has(geo.styleID) ? styleMap.get(geo.styleID) : null;
      const color2 = stylePaint ? stylePaint.paint : fillColor;
      const opAttr = stylePaint ? (stylePaint.opacityAttr || "") : fillOpacityAttr;
      if (!color2) continue;
      const d = decodeCmdBlob(blobs, geo.commandsBlob);
      if (!d) continue;
      const rule = (geo.windingRule === "ODD" || geo.windingRule === "EVENODD") ? ' fill-rule="evenodd"' : "";
      fillEntries.push({ d, color: color2, opAttr, rule });
    }
  }
  const strokeResolved = resolvePaintColorOrGradientFast(node.strokePaints, w, h);
  if (strokeResolved?.defs) defs = appendDefs(defs, strokeResolved.defs);
  const strokeColor = strokeResolved?.paint ?? null;
  const sw = node.strokeWeight ?? 0;
  const strokeAlign = node.strokeAlign ?? "CENTER";
  const dashAttr = Array.isArray(node.dashPattern) && node.dashPattern.length ? ` stroke-dasharray="${node.dashPattern.join(" ")}"` : "";
  const lineCap = node.strokeCap === "ROUND" ? "round" : node.strokeCap === "SQUARE" ? "square" : "butt";
  const lineJoin = node.strokeJoin === "ROUND" ? "round" : node.strokeJoin === "BEVEL" ? "bevel" : "miter";
  if (strokeAlign === "OUTSIDE" && strokeColor && sw > 0 && fillEntries.length) {
    for (const { d, rule } of fillEntries) {
      parts.push(
        `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${sw * 2}" stroke-linecap="${lineCap}" stroke-linejoin="${lineJoin}"${dashAttr}${rule}/>`
      );
    }
    for (const { d, color: color2, opAttr, rule } of fillEntries) {
      parts.push(`<path d="${d}" fill="${color2}"${opAttr}${rule}/>`);
    }
  } else {
    for (const { d, color: color2, opAttr, rule } of fillEntries) {
      parts.push(`<path d="${d}" fill="${color2}"${opAttr}${rule}/>`);
    }
    if (strokeColor && sw > 0 && node.strokeGeometry?.length && blobs) {
      const segments = [];
      let hasEvenOdd = false;
      for (const geo of node.strokeGeometry) {
        const d = decodeCmdBlob(blobs, geo.commandsBlob);
        if (d) segments.push(d);
        if (geo.windingRule === "ODD" || geo.windingRule === "EVENODD") hasEvenOdd = true;
      }
      if (segments.length) {
        const rule = segments.length > 1 || hasEvenOdd ? ' fill-rule="evenodd"' : "";
        parts.push(`<path d="${segments.join("")}" fill="${strokeColor}"${rule}/>`);
      }
    }
  }
  if (!parts.length && node.vectorData?.vectorNetworkBlob != null && blobs) {
    const vnbD = decodeVnb(blobs, node.vectorData.vectorNetworkBlob, node.vectorData.normalizedSize, node.size);
    if (vnbD) {
      if (!fillColor && strokeColor && sw > 0) {
        parts.push(
          `<path d="${vnbD}" fill="none" stroke="${strokeColor}" stroke-width="${sw}" stroke-linecap="${lineCap}" stroke-linejoin="${lineJoin}"${dashAttr}/>`
        );
      } else {
        const color2 = fillColor ?? strokeColor ?? "#000000";
        parts.push(`<path d="${vnbD}" fill="${color2}"${fillOpacityAttr} fill-rule="evenodd"/>`);
      }
    }
  }
  if (!parts.length) return renderPlaceholder(deck, node);
  return `<g transform="matrix(${m00},${m10},${m01},${m11},${m02},${m12})">
${defs ? `${defs}\n` : ""}${parts.join("\n")}
</g>`;
}

function renderBooleanOpFast(deck, node) {
  const ownSvg = renderVectorFast(deck, node);
  let inner = "";
  if (node.booleanOperation === "UNION") {
    const hasVisibleFill = getFillPaints(node)?.some((p) => p.visible !== false);
    if (hasVisibleFill) {
      const children = deck.getChildren(nodeId2(node));
      const childParts = [];
      for (const child of children) {
        if (child.phase === "REMOVED") continue;
        const origFills = child.fillPaints;
        child.fillPaints = getFillPaints(node);
        childParts.push(renderNode(deck, child));
        child.fillPaints = origFills;
      }
      inner = childParts.filter(Boolean).join("\n");
    }
  }
  if (!ownSvg && !inner) return "";
  if (!inner) return ownSvg;
  if (!ownSvg) {
    const t = node.transform ?? {};
    const m00 = t.m00 ?? 1, m01 = t.m01 ?? 0, m02 = t.m02 ?? 0;
    const m10 = t.m10 ?? 0, m11 = t.m11 ?? 1, m12 = t.m12 ?? 0;
    return `<g transform="matrix(${m00},${m10},${m01},${m11},${m02},${m12})">\n${inner}\n</g>`;
  }
  return `${ownSvg}\n${inner}`;
}

function renderEllipseFast(deck, node) {
  const { w, h } = size(node);
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const fills = getFillPaints(node)?.filter((p) => p.visible !== false) ?? [];
  let fillSvg = "";
  if (fills.some((p) => p.type !== "SOLID")) {
    const stack = renderRoundedRectFillStack(deck, fills, w, h, 0);
    if (stack.bg) {
      const clipId = `ellipse-clip-${++_svgIdSeq}`;
      const defs = appendDefs(stack.defs, `<clipPath id="${clipId}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath>`);
      fillSvg = `${defs}\n<g clip-path="url(#${clipId})">${stack.bg}</g>`;
    }
  } else {
    const fill2 = resolveFill(fills) ?? "none";
    fillSvg = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill2}"/>`;
  }
  const geoStroke = strokeGeometrySvg(deck, node);
  const strokeSvg = geoStroke || ellipseStrokeSvg(cx, cy, rx, ry, strokeSpec(node));
  const inner = geoStroke ? [strokeSvg, fillSvg].filter(Boolean).join("\n") : [fillSvg, strokeSvg].filter(Boolean).join("\n");
  return `<g transform="${svgTransform(node)}">\n${inner}\n</g>`;
}

function renderRectFast(deck, node) {
  const { w, h } = size(node);
  const radiiInfo = getNodeRadii(node);
  if (radiiInfo.independent) {
    const pathD = independentRoundedRectPath(0, 0, w, h, radiiInfo.radii);
    const fills = getFillPaints(node)?.filter((p) => p.visible !== false) ?? [];
    let fillSvg = "";
    if (fills.some((p) => p.type !== "SOLID")) {
      const stack = renderRoundedRectFillStack(deck, fills, w, h, 0);
      if (stack.bg) {
        const clipId = `rect-clip-${++_svgIdSeq}`;
        const defs = appendDefs(stack.defs, `<clipPath id="${clipId}"><path d="${pathD}"/></clipPath>`);
        fillSvg = `${defs}\n<g clip-path="url(#${clipId})">${stack.bg}</g>`;
      }
    } else {
      const fillColor = resolveFill(fills) ?? "none";
      if (fillColor !== "none") fillSvg = `<path d="${pathD}" fill="${fillColor}"/>`;
    }
    const geoStroke = strokeGeometrySvg(deck, node);
    const stroke = strokeSpec(node);
    const strokeSvg = geoStroke || (stroke ? `<path d="${pathD}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.width}"/>` : "");
    const inner = [fillSvg, strokeSvg].filter(Boolean).join("\n");
    return inner ? `<g transform="${svgTransform(node)}">\n${inner}\n</g>` : "";
  }
  const rx = Math.min(node.cornerRadius ?? 0, w / 2, h / 2);
  const { defs, bg } = renderRoundedRectFillStack(deck, getFillPaints(node), w, h, rx);
  const fillSvg = bg ? `${[defs, bg].filter(Boolean).join("\n")}` : "";
  const geoStroke = strokeGeometrySvg(deck, node);
  const strokeSvg = geoStroke || rectStrokeSvg(0, 0, w, h, rx, strokeSpec(node));
  const inner = geoStroke ? [strokeSvg, fillSvg].filter(Boolean).join("\n") : [fillSvg, strokeSvg].filter(Boolean).join("\n");
  if (!inner) return "";
  return `<g transform="${svgTransform(node)}">\n${inner}\n</g>`;
}

function renderFrameFast(deck, node) {
  const { w, h } = size(node);
  const radiiInfo = getNodeRadii(node);
  const rx = Math.min(node.cornerRadius ?? 0, w / 2, h / 2);
  const stroke = strokeSpec(node);
  const inner = childrenSvg(deck, node);
  const fills = getFillPaints(node)?.filter((p) => p.visible !== false) ?? [];
  const hasFill = fills.length > 0;
  let defs = "";
  let bg = "";
  const indepPath = radiiInfo.independent ? independentRoundedRectPath(0, 0, w, h, radiiInfo.radii) : null;
  if (indepPath && hasFill) {
    if (fills.length === 1 && fills[0].type === "SOLID") {
      bg = `<path d="${indepPath}" fill="${cssColor(fills[0].color ?? {}, fills[0].opacity ?? 1)}"/>`;
    } else {
      const stack = renderRoundedRectFillStack(deck, fills, w, h, 0);
      if (stack.bg) {
        const bgClipId = `frame-bg-clip-${++_svgIdSeq}`;
        defs = appendDefs(stack.defs, `<clipPath id="${bgClipId}"><path d="${indepPath}"/></clipPath>`);
        bg = `<g clip-path="url(#${bgClipId})">${stack.bg}</g>`;
      }
    }
  } else {
    const stack = renderRoundedRectFillStack(deck, fills, w, h, rx);
    defs = stack.defs;
    bg = stack.bg;
  }
  let clippedInner = inner;
  if (inner && node.frameMaskDisabled === false && _symbolDepth === 0 && hasFill) {
    const clipId = `frame-clip-${++_svgIdSeq}`;
    const clipShape = indepPath
      ? `<path d="${indepPath}"/>`
      : `<rect width="${w}" height="${h}" rx="${rx}" ry="${rx}"/>`;
    defs = appendDefs(defs, `<clipPath id="${clipId}">${clipShape}</clipPath>`);
    clippedInner = `<g clip-path="url(#${clipId})">${inner}</g>`;
  }
  const strokeSvg = frameStrokeSvgFast(node, w, h, rx, stroke);
  const parts = [defs, bg, clippedInner, strokeSvg].filter(Boolean).join("\n");
  if (!parts) return "";
  return `<g transform="${svgTransform(node)}">\n${parts}\n</g>`;
}

if (typeof RENDERERS === "object" && RENDERERS) {
  RENDERERS.VECTOR = renderVectorFast;
  RENDERERS.STAR = renderVectorFast;
  RENDERERS.REGULAR_POLYGON = renderVectorFast;
  RENDERERS.POLYGON = renderVectorFast;
  RENDERERS.BOOLEAN_OPERATION = renderBooleanOpFast;
  RENDERERS.ELLIPSE = renderEllipseFast;
  RENDERERS.ROUNDED_RECTANGLE = renderRectFast;
  RENDERERS.RECTANGLE = renderRectFast;
  RENDERERS.FRAME = renderFrameFast;
}

function resolveFrameScene(doc, targetNodeId) {
  const nodes = new Map();
  const children = new Map();
  const parentMap = new Map();
  let sequence = 0;
  const diagnostics = { propertiesApplied: 0, overridesApplied: 0, derivedApplied: 0, slotsResolved: 0, missingSymbols: [], unresolvedProperties: [], unrenderableNodes: [] };
  const guidKey = (guid) => guid ? `${guid.sessionID}:${guid.localID}` : null;
  const indexRecords = (records = []) => {
    const index = new Map();
    for (const record of records) {
      const key = (record.guidPath?.guids || []).map(guidKey).join("/");
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(record);
    }
    return index;
  };
  const mergeAssignments = (original = [], incoming = []) => [...new Map(
    [...original, ...incoming].map((assignment) => [guidKey(assignment.defID), assignment]),
  ).values()];
  const propertyFields = { VISIBLE: "visible", TEXT_DATA: "textData", CHARACTERS: "textData", OPACITY: "opacity", OVERRIDDEN_SYMBOL_ID: "symbolID", SLOT_CONTENT_ID: "slotContentReference" };
  function definitionValue(key, seen = new Set()) {
    if (seen.has(key)) return undefined;
    seen.add(key);
    const definition = doc.componentDefinitions?.get(key);
    return definition?.varValue || (definition?.parentPropDefId ? definitionValue(guidKey(definition.parentPropDefId), seen) : undefined);
  }
  function propertyValue(variable, properties, seen = new Set()) {
    if (!variable) return undefined;
    const reference = variable.value?.propRefValue?.defId;
    if (reference) {
      const key = guidKey(reference);
      if (seen.has(key)) return undefined;
      seen.add(key);
      return propertyValue(properties.get(key) || definitionValue(key), properties, seen);
    }
    return variable.value;
  }
  function applyRecord(node, record, derived = false) {
    if (!record) return;
    if (Array.isArray(record)) {
      for (const entry of record) applyRecord(node, entry, derived);
      return;
    }
    for (const [field, value] of Object.entries(record)) {
      if (field === "guidPath") continue;
      if (field === "componentPropAssignments") node[field] = mergeAssignments(node[field], value);
      else if (field === "parameterConsumptionMap") node[field] = {
        ...node[field], ...value,
        entries: [...new Map([...(node[field]?.entries || []), ...(value?.entries || [])].map((entry) => [entry.variableField, entry])).values()],
      };
      else if (field === "overriddenSymbolID") node.symbolData = { ...node.symbolData, symbolID: value };
      else node[field] = value;
    }
    diagnostics[derived ? "derivedApplied" : "overridesApplied"] += 1;
  }
  function matchedRecord(scope, table, node) {
    for (const key of [guidKey(node.overrideKey), guidKey(node.guid)].filter(Boolean)) {
      const record = scope[table].get([...scope.prefix, key].join("/"));
      if (record) return record;
    }
    return null;
  }
  function applyScopes(node, raw, scopes, table) {
    for (const scope of scopes) applyRecord(node, matchedRecord(scope, table, raw), table === "derived");
  }
  function consumeProperties(node, properties) {
    for (const binding of node.parameterConsumptionMap?.entries || []) {
      if (!binding.variableData?.value?.propRefValue) continue;
      const value = propertyValue(binding.variableData, properties);
      const field = propertyFields[binding.variableField];
      if (!value || !field) {
        diagnostics.unresolvedProperties.push({ node: guidKey(node.guid), field: binding.variableField });
        continue;
      }
      if (field === "textData" && value.textDataValue) node.textData = { ...node.textData, ...value.textDataValue };
      else if (field === "visible" && typeof value.boolValue === "boolean") node.visible = value.boolValue;
      else if (field === "opacity" && typeof value.floatValue === "number") node.opacity = value.floatValue;
      else if (field === "symbolID" && value.symbolIdValue?.guid) node.symbolData = { ...node.symbolData, symbolID: value.symbolIdValue.guid };
      else if (field === "slotContentReference" && value.slotContentIdValue?.guid) node.slotContentReference = guidKey(value.slotContentIdValue.guid);
      else continue;
      diagnostics.propertiesApplied += 1;
    }
  }
  function expand(raw, scopes, properties, parentGuid, instancePath, symbolStack, depth = 0) {
    if (depth > 100 || nodes.size > 150000) throw new Error("Component expansion exceeds the scene safety limit.");
    let node = { ...raw };
    const originalText = node.textData?.characters;
    const originalDerived = node.derivedTextData;
    applyScopes(node, raw, scopes, "overrides");
    consumeProperties(node, properties);
    applyScopes(node, raw, scopes, "overrides");
    let nextScopes = scopes;
    let nextProperties = properties;
    let descendants = doc.children.get(guidKey(raw.guid)) || [];
    let nextStack = symbolStack;
    let nextPath = instancePath;
    const slot = doc.nodes.get(node.slotContentReference);
    if (slot && slot !== raw) {
      node = { ...node, ...slot, guid: raw.guid, transform: node.transform };
      descendants = doc.children.get(node.slotContentReference) || [];
      diagnostics.slotsResolved += 1;
    }
    if (node.type === "INSTANCE") {
      const symbolId = guidKey(node.symbolData?.symbolID);
      const symbol = doc.nodes.get(symbolId);
      if (!symbol || symbolStack.has(symbolId)) {
        diagnostics.missingSymbols.push({ instance: guidKey(raw.guid), symbol: symbolId });
      } else {
        nextStack = new Set(symbolStack).add(symbolId);
        const ownScope = {
          prefix: [], overrides: indexRecords(node.symbolData?.symbolOverrides),
          derived: indexRecords(node.derivedSymbolData),
        };
        const instance = node;
        const replaced = symbolId !== guidKey(raw.symbolData?.symbolID);
        const instanceFields = replaced ? Object.fromEntries([
          "guid", "parentIndex", "overrideKey", "name", "visible", "opacity", "transform", "size",
          "symbolData", "derivedSymbolData", "componentPropAssignments",
        ].filter((field) => Object.hasOwn(instance, field)).map((field) => [field, instance[field]])) : instance;
        node = { ...symbol, type: "FRAME" };
        applyRecord(node, matchedRecord(ownScope, "overrides", symbol));
        applyRecord(node, instanceFields);
        node.type = "FRAME";
        applyScopes(node, raw, scopes, "overrides");
        node.transform = instance.transform;
        node.size = instance.size || symbol.size;
        node.visible = instance.visible;
        nextProperties = new Map(properties);
        for (const definition of symbol.componentPropDefs || []) {
          const key = guidKey(definition.id);
          const value = definition.varValue || definitionValue(key);
          if (value) nextProperties.set(key, value);
        }
        for (const assignment of node.componentPropAssignments || []) {
          const resolved = propertyValue(assignment.varValue, properties);
          nextProperties.set(guidKey(assignment.defID), resolved ? { ...assignment.varValue, value: resolved } : assignment.varValue);
        }
        applyRecord(node, matchedRecord(ownScope, "derived", symbol), true);
        nextScopes = [ownScope, ...scopes.map((scope) => ({
          ...scope, prefix: [...scope.prefix, guidKey(raw.overrideKey) || guidKey(raw.guid)],
        }))];
        nextPath = [...instancePath, guidKey(raw.overrideKey) || guidKey(raw.guid)];
        descendants = doc.children.get(symbolId) || [];
      }
    }
    applyScopes(node, raw, scopes, "derived");
    if (node.textData?.characters !== originalText && node.derivedTextData === originalDerived) node.derivedTextData = undefined;
    if (node.type === "SYMBOL" || node.type === "COMPONENT") node.type = "FRAME";
    const radii = getNodeRadii(node);
    if (!radii.independent) node.cornerRadius = radii.uniform;
    const sceneGuid = { sessionID: `scene/${targetNodeId}`, localID: ++sequence };
    node = { ...node, guid: sceneGuid, originalNodeId: guidKey(raw.guid), instancePath: [...instancePath], parentIndex: { guid: parentGuid } };
    const key = guidKey(sceneGuid);
    nodes.set(key, node);
    if (parentGuid) parentMap.set(key, guidKey(parentGuid));
    const expandedChildren = [];
    children.set(key, expandedChildren);
    if (node.visible !== false) {
      for (const child of descendants) expandedChildren.push(expand(child, nextScopes, nextProperties, sceneGuid, nextPath, nextStack, depth + 1));
    }
    return node;
  }
  const rawTarget = doc.nodes.get(targetNodeId);
  if (!rawTarget) throw new Error("Frame not found.");
  const root = expand(rawTarget, [], new Map(), null, [], new Set());
  root.transform = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
  if (root.type === "SYMBOL" || root.type === "COMPONENT") root.type = "FRAME";
  return { root, nodes, children, parentMap, diagnostics, frameId: targetNodeId };
}

function renderFrameEnhanced(doc, targetNodeId, options = {}) {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const original = doc.nodes.get(targetNodeId);
  if (!original) throw new Error("未找到指定画板或节点：" + targetNodeId);
  const width = Math.ceil(original.size?.x ?? 0);
  const height = Math.ceil(original.size?.y ?? 0);
  if (!(width > 0 && height > 0) || width > 30000 || height > 30000) {
    throw new Error("请选择尺寸大于 0 且单边不超过 30,000 px 的可视节点。");
  }

  const useGlyphOutlines = options.useGlyphOutlines !== false;
  const scene = resolveFrameScene(doc, targetNodeId);
  if (options.rememberScene !== false) doc.renderScene = scene;
  const counts = { visited: 0, outlinedText: 0, fallbackText: 0, emptyGlyphs: 0 };
  const hitBoxes = [];
  const ROOT_ID = "2147483647:2147483647";

  const getClonedNode = (key) => scene.nodes.get(key);
  const target = scene.root;

  // Collect hit-testing boxes in frame-local coordinates by walking the visible hierarchy
  function collectHitBoxes(node, parentMatrix, depth) {
    if (!node || node.phase === "REMOVED" || node.visible === false) return;
    const id = nodeId(node);
    if (!id) return;
    const localMat =
      id === targetNodeId
        ? { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        : {
            m00: node.transform?.m00 ?? 1,
            m01: node.transform?.m01 ?? 0,
            m02: node.transform?.m02 ?? 0,
            m10: node.transform?.m10 ?? 0,
            m11: node.transform?.m11 ?? 1,
            m12: node.transform?.m12 ?? 0
          };
    const worldMat = multiplyAffine(parentMatrix, localMat);
    const nw = node.size?.x ?? 0;
    const nh = node.size?.y ?? 0;
    if (nw > 0 && nh > 0 && hitBoxes.length < 4000) {
      const box = transformBBox(worldMat, nw, nh);
      if (box.w >= 1 && box.h >= 1) {
        hitBoxes.push({
          id: node === target ? targetNodeId : id,
          sourceId: node.originalNodeId,
          instancePath: node.instancePath,
          name: node.name || node.type,
          type: node.type,
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          depth,
          text: node.textData?.characters ? node.textData.characters.slice(0, 120) : null
        });
      }
    }
    if (depth > 24) return;
    const rawChildren = scene.children.get(id) ?? [];
    for (const child of rawChildren) {
      if (child.visible === false || child.phase === "REMOVED") continue;
      collectHitBoxes(child, worldMat, depth + 1);
    }
  }

  collectHitBoxes(target, { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }, 0);

  const root = {
    guid: { sessionID: 2147483647, localID: 2147483647 },
    size: { x: width, y: height }
  };

  const adapter = {
    message: doc.parsed.message,
    imagesDir: "memory-only",
    getNode: getClonedNode,
    getChildren(key) {
      if (key === ROOT_ID) return [target];
      return (scene.children.get(key) ?? [])
        .map((n) => getClonedNode(nodeId(n)))
        .filter((n) => n && n.visible !== false);
    },
    readImage(hash) {
      if (typeof hash !== "string") throw new Error("无效的图片资源标识。");
      const bytes = doc.parsed.images.get(hash);
      if (!bytes) throw new Error(`缺少内嵌图片资源 ${hash}`);
      // Provide a Uint8Array with .toString('base64') compatibility for openfig svg-builder
      const view = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      view.toString = function (encoding) {
        if (encoding === "base64") return uint8ToBase64(view);
        return new TextDecoder().decode(view);
      };
      return view;
    },
    renderGlyphOutlines(node) {
      if (!useGlyphOutlines) return null;
      return renderGlyphOutlinesFast(doc, node, counts);
    },
    reportPlaceholder(node) {
      scene.diagnostics.unrenderableNodes.push({ sourceId: node.originalNodeId, type: node.type, name: node.name });
    },
    visit() {
      counts.visited += 1;
      if (counts.visited > 150000) throw new Error("画板节点复杂度超过单次安全渲染上限。");
    }
  };

  const svg = frameToSvg(adapter, root);
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const renderMs = Math.max(1, Math.round(t1 - t0));

  return {
    svg,
    width,
    height,
    nodeId: targetNodeId,
    name: original.name || original.type,
    type: original.type,
    renderMs,
    hitBoxes,
    resolution: scene.diagnostics,
    resolvedText: options.includeResolvedText ? [...scene.nodes.values()].filter((node) => node.visible !== false && node.type === "TEXT").map((node) => ({ sourceId: node.originalNodeId, instancePath: node.instancePath, text: node.textData?.characters, glyphs: node.derivedTextData?.glyphs?.length || 0 })) : undefined,
    ...counts
  };
}
