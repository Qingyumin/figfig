// FigFig Worker Dispatcher (supports both Browser Web Worker and Node.js test/benchmark import)

const documents = new Map();

async function sha256HexInBrowser(bytes) {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    const hashArray = new Uint8Array(hashBuffer);
    let hex = "";
    for (let i = 0; i < hashArray.length; i++) {
      hex += hashArray[i].toString(16).padStart(2, "0");
    }
    return hex;
  }
  return "";
}

function getDocOrThrow(docId) {
  const doc = documents.get(docId || "default");
  if (!doc) throw new Error("当前标签页未加载设计文档。");
  return doc;
}

async function handleWorkerRequest(operation, args = {}) {
  const docId = args.docId || "default";

  if (operation === "loadUrl") {
    const resp = await fetch(args.url);
    if (!resp.ok) {
      throw new Error(`读取本地文件流失败 (HTTP ${resp.status})`);
    }
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const sha256 = await sha256HexInBrowser(bytes);
    if (args.sha256 && sha256 !== args.sha256) throw new Error("File changed between selection and read. Reopen the file.");
    const doc = parseDocumentFast(bytes, {
      fileName: args.fileName || "Design.fig",
      sha256
    });
    documents.set(docId, doc);
    return getDocumentSummary(doc);
  }

  if (operation === "loadBytes") {
    const bytes =
      args.bytes instanceof Uint8Array
        ? args.bytes
        : new Uint8Array(args.bytes);
    const sha256 = args.sha256 || (await sha256HexInBrowser(bytes));
    const doc = parseDocumentFast(bytes, {
      fileName: args.fileName || "Design.fig",
      sha256
    });
    documents.set(docId, doc);
    return getDocumentSummary(doc);
  }

  if (operation === "closeDoc") {
    documents.delete(docId);
    return { closed: true, docId };
  }

  const doc = getDocOrThrow(docId);

  switch (operation) {
    case "summary":
      return getDocumentSummary(doc);

    case "pages":
      return getPagesList(doc, args);

    case "frames":
      return getFramesOnPage(doc, args.pageId, args);

    case "children":
      return getChildrenOfNode(doc, args.nodeId, args);

    case "node":
      return getNodeDetail(doc, args.nodeId, args);

    case "search":
      return searchNodesFast(doc, args.query, args);

    case "compatibility":
      return getCompatibilityReport(doc);

    case "thumbnail": {
      if (!doc.parsed.thumbnail) return null;
      const b64 = uint8ToBase64(doc.parsed.thumbnail);
      return `data:image/png;base64,${b64}`;
    }

    case "render": {
      const rendered = renderFrameEnhanced(doc, args.nodeId, {
        useGlyphOutlines: args.useGlyphOutlines !== false
      });
      const svgBytes = new TextEncoder().encode(rendered.svg);
      const uri = `data:image/svg+xml;base64,${uint8ToBase64(svgBytes)}`;
      return {
        ...rendered,
        svg: args.includeRawSvg ? rendered.svg : undefined,
        uri
      };
    }

    case "exportSvg": {
      const rendered = renderFrameEnhanced(doc, args.nodeId, {
        useGlyphOutlines: args.useGlyphOutlines !== false,
        rememberScene: false
      });
      return {
        nodeId: args.nodeId,
        name: rendered.name,
        width: rendered.width,
        height: rendered.height,
        svg: rendered.svg
      };
    }

    case "batchThumbnails": {
      const ids = Array.isArray(args.nodeIds) ? args.nodeIds.slice(0, 24) : [];
      const items = [];
      for (const id of ids) {
        try {
          const rendered = renderFrameEnhanced(doc, id, {
            useGlyphOutlines: args.useGlyphOutlines !== false,
            rememberScene: false
          });
          const svgBytes = new TextEncoder().encode(rendered.svg);
          items.push({
            id,
            name: rendered.name,
            width: rendered.width,
            height: rendered.height,
            renderMs: rendered.renderMs,
            visited: rendered.visited,
            uri: `data:image/svg+xml;base64,${uint8ToBase64(svgBytes)}`
          });
        } catch (err) {
          items.push({
            id,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      return { items };
    }

    case "listAssets": {
      return {
        total: doc.imageAssets.length,
        items: doc.imageAssets
      };
    }

    case "getAssetData": {
      const bytes = doc.parsed.images.get(args.hash);
      if (!bytes) throw new Error(`未找到原图资源：${args.hash}`);
      const info = inspectImageHeader(bytes);
      const base64 = uint8ToBase64(bytes);
      return {
        hash: args.hash,
        byteLength: bytes.byteLength,
        mime: info.mime,
        ext: info.ext,
        width: info.width,
        height: info.height,
        base64,
        dataUri: `data:${info.mime};base64,${base64}`
      };
    }

    default:
      throw new Error(`未知引擎操作：${operation}`);
  }
}

if (typeof self !== "undefined" && typeof self.postMessage === "function") {
  self.onmessage = async (event) => {
    const message = event.data;
    if (!message || !message.id) return;
    try {
      const result = await handleWorkerRequest(message.operation, message.args || {});
      self.postMessage({ id: message.id, ok: true, result });
    } catch (error) {
      self.postMessage({
        id: message.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    handleWorkerRequest,
    parseDocumentFast,
    decodeCmdBlobFast,
    renderFrameEnhanced,
    getFramesOnPage,
    getPagesList,
    getNodeDetail,
    searchNodesFast,
    getCompatibilityReport
  };
}
