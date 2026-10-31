// FigFig 1.0 Desktop Frontend Controller
(() => {
  const $ = (id) => document.getElementById(id);
  const isNativeHost = Boolean(window.chrome && window.chrome.webview);

  // Worker RPC
  const worker = new Worker("worker.js");
  let rpcSeq = 0;
  const workerPending = new Map();

  worker.onmessage = (event) => {
    const msg = event.data;
    const entry = workerPending.get(msg?.id);
    if (!entry) return;
    workerPending.delete(msg.id);
    clearTimeout(entry.timer);
    if (msg.ok) entry.resolve(msg.result);
    else entry.reject(new Error(msg.error || "Worker error"));
  };

  function callWorker(operation, args = {}, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const id = ++rpcSeq;
      const timer = setTimeout(() => {
        workerPending.delete(id);
        reject(new Error(`操作超时 (${operation})`));
      }, timeoutMs);
      workerPending.set(id, { resolve, reject, timer });
      worker.postMessage({ id, operation, args });
    });
  }

  // Native Host RPC (WebView2)
  let hostSeq = 0;
  const hostPending = new Map();
  if (isNativeHost) {
    window.chrome.webview.addEventListener("message", (event) => {
      const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      if (data?.event === "openFileFromHost" && data.payload) {
        openRegisteredHostDocument(data.payload).catch(showError);
        return;
      }
      const entry = hostPending.get(data?.id);
      if (!entry) return;
      hostPending.delete(data.id);
      if (data.ok) entry.resolve(data.value);
      else entry.reject(new Error(data.error || "Host operation failed"));
    });
  }

  function callHost(kind, payload = {}) {
    if (!isNativeHost) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const id = "h_" + ++hostSeq;
      hostPending.set(id, { resolve, reject });
      window.chrome.webview.postMessage({ id, kind, payload });
    });
  }

  // Hidden file input fallback for browser/standalone mode
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".fig,.deck";
  fileInput.hidden = true;
  document.body.appendChild(fileInput);

  // Application State
  const tabs = new Map(); // docId -> tabState
  let activeDocId = null;
  let viewMode = "canvas"; // "canvas" | "gallery"
  let inspectEnabled = true;
  let measureEnabled = false;
  let useGlyphOutlines = true;
  let isSpaceDown = false;
  let isPanning = false;
  let panStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };
  let hoveredHitBox = null;
  let selectedHitBox = null;
  let currentNodeDetail = null;
  let searchDebounce = null;

  const workspace = document.querySelector(".workspace");
  const panelDefaults = { sidebar: 268, inspector: 308 };
  let panelWidths = { ...panelDefaults };
  try {
    const stored = JSON.parse(localStorage.getItem("figfig-panel-widths") || "null");
    for (const side of Object.keys(panelDefaults)) if (Number.isFinite(stored?.[side])) panelWidths[side] = stored[side];
  } catch {}
  const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);
  function applyPanelWidths() {
    const width = workspace.clientWidth;
    const narrow = width < 680;
    const leftMinimum = narrow ? 128 : 180;
    const budget = width - (narrow ? 6 : 12) - (narrow ? 140 : 240);
    const leftMaximum = Math.max(leftMinimum, Math.min(narrow ? 210 : 540, budget - (narrow ? 0 : 220)));
    const left = clamp(panelWidths.sidebar, leftMinimum, leftMaximum);
    const rightMaximum = Math.max(220, Math.min(540, budget - left));
    const right = narrow ? 0 : clamp(panelWidths.inspector, 220, rightMaximum);
    workspace.style.setProperty("--sidebar-width", `${left}px`);
    workspace.style.setProperty("--inspector-width", `${right}px`);
    for (const [side, actual, minimum, maximum] of [["sidebar", left, leftMinimum, leftMaximum], ["inspector", right, 220, rightMaximum]]) {
      const handle = $(`resize-${side}`);
      handle.setAttribute("aria-valuenow", String(Math.round(actual)));
      handle.setAttribute("aria-valuemin", String(minimum));
      handle.setAttribute("aria-valuemax", String(Math.round(maximum)));
    }
  }
  function savePanelWidths() {
    try { localStorage.setItem("figfig-panel-widths", JSON.stringify(panelWidths)); } catch {}
  }
  for (const side of Object.keys(panelDefaults)) {
    const handle = $(`resize-${side}`);
    let drag = null;
    const updateWidth = (value) => {
      panelWidths[side] = clamp(value, Number(handle.getAttribute("aria-valuemin")), Number(handle.getAttribute("aria-valuemax")));
      applyPanelWidths();
    };
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      drag = { x: event.clientX, width: Number(handle.getAttribute("aria-valuenow")), original: panelWidths[side], pointerId: event.pointerId };
      handle.setPointerCapture(event.pointerId);
      handle.classList.add("dragging");
      document.body.classList.add("resizing-panels");
    });
    handle.addEventListener("pointermove", (event) => {
      if (!drag) return;
      updateWidth(drag.width + (event.clientX - drag.x) * (side === "sidebar" ? 1 : -1));
    });
    const finish = (cancelled = false) => {
      if (!drag) return;
      const previous = drag;
      drag = null;
      if (cancelled) { panelWidths[side] = previous.original; applyPanelWidths(); }
      if (handle.hasPointerCapture(previous.pointerId)) handle.releasePointerCapture(previous.pointerId);
      handle.classList.remove("dragging");
      document.body.classList.remove("resizing-panels");
      savePanelWidths();
    };
    handle.addEventListener("pointerup", () => finish());
    handle.addEventListener("pointercancel", () => finish(true));
    handle.addEventListener("lostpointercapture", () => finish());
    handle.addEventListener("dblclick", () => { panelWidths[side] = panelDefaults[side]; applyPanelWidths(); savePanelWidths(); });
    handle.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { finish(true); return; }
      if (event.key === "Home") { event.preventDefault(); panelWidths[side] = panelDefaults[side]; applyPanelWidths(); savePanelWidths(); return; }
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const step = (event.shiftKey ? 40 : 10) * (event.key === "ArrowRight" ? 1 : -1) * (side === "sidebar" ? 1 : -1);
      updateWidth(Number(handle.getAttribute("aria-valuenow")) + step);
      savePanelWidths();
    });
  }
  new ResizeObserver(applyPanelWidths).observe(workspace);
  applyPanelWidths();

  function activeTab() {
    return activeDocId ? tabs.get(activeDocId) : null;
  }

  function setStatus(text) {
    $("status-text").textContent = text;
  }

  function showError(err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus("错误：" + msg);
    console.error(err);
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function fmtNum(n) {
    return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "-";
  }

  // Tab Bar Rendering
  function renderTabs() {
    const container = $("doc-tabs");
    container.replaceChildren();
    for (const [docId, tab] of tabs.entries()) {
      const el = document.createElement("div");
      el.className = "doc-tab" + (docId === activeDocId ? " active" : "");
      el.setAttribute("role", "tab");
      el.setAttribute("aria-selected", String(docId === activeDocId));
      el.title = `${tab.summary.fileName}\n大小: ${formatBytes(tab.summary.byteLength)}\n节点: ${tab.summary.nodeCount.toLocaleString()}\nSHA-256: ${tab.summary.sha256 || "已校验"}`;

      const titleSpan = document.createElement("span");
      titleSpan.className = "tab-title";
      titleSpan.textContent = tab.summary.fileName;
      el.appendChild(titleSpan);

      const msSpan = document.createElement("span");
      msSpan.className = "tab-ms";
      msSpan.textContent = `${tab.summary.parseMs}ms`;
      el.appendChild(msSpan);

      const closeBtn = document.createElement("button");
      closeBtn.className = "tab-close";
      closeBtn.textContent = "✕";
      closeBtn.title = "关闭此文档标签页";
      closeBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        closeTab(docId).catch(showError);
      });
      el.appendChild(closeBtn);

      el.addEventListener("click", () => {
        if (activeDocId !== docId) {
          switchTab(docId).catch(showError);
        }
      });
      container.appendChild(el);
    }
  }

  async function closeTab(docId) {
    const tab = tabs.get(docId);
    if (!tab) return;
    tabs.delete(docId);
    await callWorker("closeDoc", { docId });
    if (activeDocId === docId) {
      const remaining = [...tabs.keys()];
      activeDocId = remaining.length ? remaining[remaining.length - 1] : null;
      if (activeDocId) {
        await switchTab(activeDocId);
      } else {
        resetEmptyWorkspace();
      }
    }
    renderTabs();
  }

  function resetEmptyWorkspace() {
    $("page-select").replaceChildren();
    $("page-count-badge").textContent = "0";
    $("nav-list").replaceChildren();
    $("board-wrap").hidden = true;
    $("gallery-view").hidden = true;
    $("canvas-empty").hidden = false;
    $("empty-title").textContent = "未打开文件";
    $("empty-subtitle").textContent = "FigFig";
    $("current-frame-title").textContent = "未打开文档";
    $("render-perf-badge").hidden = true;
    $("btn-export-svg").disabled = true;
    $("btn-export-png").disabled = true;
    $("btn-export-html").disabled = true;
    for (const id of ["btn-copy-css", "btn-copy-text", "btn-copy-json"]) $(id).disabled = true;
    currentNodeDetail = null;
    selectedHitBox = null;
    hoveredHitBox = null;
    $("dimensions-readout").textContent = "";
    $("hover-readout").textContent = "";
    $("sha-badge").textContent = "SHA-256 校验";
    $("inspector-body").innerHTML =
      '<div class="muted-empty">未选择图层</div>';
    setStatus("就绪");
  }

  async function openRegisteredHostDocument(hostDoc) {
    // Check if already open by path
    for (const [id, t] of tabs.entries()) {
      if (t.filePath && hostDoc.path && t.filePath.toLowerCase() === hostDoc.path.toLowerCase()) {
        await switchTab(id);
        return;
      }
    }
    const docId = "doc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    setStatus(`正在极速解析 ${hostDoc.name} (${formatBytes(hostDoc.byteLength)})...`);
    $("canvas-empty").hidden = false;
    $("empty-title").textContent = `正在读取 ${hostDoc.name}...`;
    $("empty-subtitle").textContent = `只读流加载中 · SHA-256: ${(hostDoc.sha256 || "").slice(0, 16)}...`;

    const summary = await callWorker("loadUrl", {
      docId,
      url: hostDoc.streamUrl,
      fileName: hostDoc.name,
      sha256: hostDoc.sha256
    });

    await setupNewTab(docId, summary, hostDoc.path);
  }

  async function openFromUrl(url, fileName) {
    const docId = "doc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    setStatus(`正在加载 ${fileName}...`);
    const summary = await callWorker("loadUrl", {
      docId,
      url,
      fileName
    });
    await setupNewTab(docId, summary, null);
  }

  async function openFromBytes(bytes, fileName) {
    const docId = "doc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    setStatus(`正在解析 ${fileName} (${formatBytes(bytes.byteLength)})...`);
    const summary = await callWorker("loadBytes", {
      docId,
      bytes,
      fileName
    });
    await setupNewTab(docId, summary, null);
  }

  async function setupNewTab(docId, summary, filePath) {
    const tabState = {
      docId,
      filePath,
      summary,
      pageId: null,
      navTab: "frames", // "frames" | "layers" | "assets"
      layerTrail: [],
      nextOffset: null,
      currentFrameId: null,
      selectedNodeId: null,
      scale: 1,
      fitted: true,
      nativeWidth: 0,
      nativeHeight: 0,
      hitBoxes: []
    };
    tabs.set(docId, tabState);
    activeDocId = docId;
    renderTabs();
    await refreshTabUI();
  }

  async function switchTab(docId) {
    if (!tabs.has(docId)) return;
    activeDocId = docId;
    renderTabs();
    await refreshTabUI();
  }

  async function refreshTabUI() {
    const tab = activeTab();
    if (!tab) return;
    const { summary } = tab;
    const shortSha = summary.sha256 ? summary.sha256.slice(0, 10).toUpperCase() : "READONLY";
    $("sha-badge").textContent = `只读 · ${shortSha}`;
    $("count-assets").textContent = summary.imageCount ? `(${summary.imageCount})` : "";

    if (isNativeHost) {
      callHost("setTitle", {
        title: `${summary.fileName} — FigFig (${summary.nodeCount.toLocaleString()} 节点 · ${summary.parseMs}ms)`
      });
    }

    await loadPagesForActiveTab(tab.pageId);
    setStatus(
      `已加载 ${summary.fileName} · ${summary.nodeCount.toLocaleString()} 个节点 · ${summary.imageCount} 张内嵌原图 · 解析耗时 ${summary.parseMs} ms`
    );
  }

  async function loadPagesForActiveTab(preferredPageId) {
    const tab = activeTab();
    if (!tab) return;
    const includeInternal = $("include-internal").checked;
    const pageList = await callWorker("pages", {
      docId: tab.docId,
      includeInternal
    });
    if (activeTab() !== tab) return;
    $("page-count-badge").textContent = String(pageList.length);
    const select = $("page-select");
    select.replaceChildren(
      ...pageList.map((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.childCount})`;
        return opt;
      })
    );
    if (!pageList.length) {
      $("canvas-empty").hidden = false;
      $("empty-title").textContent = "当前文件没有可见页面";
      return;
    }
    const chosenId = pageList.some((p) => p.id === preferredPageId)
      ? preferredPageId
      : pageList[0].id;
    select.value = chosenId;
    await selectPage(chosenId);
  }

  async function selectPage(pageId) {
    const tab = activeTab();
    if (!tab) return;
    const isSamePage = tab.pageId === pageId;
    tab.pageId = pageId;
    const pageName =
      $("page-select").selectedOptions[0]?.textContent?.replace(/\s*\(\d+\)$/, "") || "页面";
    if (!isSamePage || !tab.layerTrail?.length) {
      tab.layerTrail = [{ id: pageId, name: pageName }];
    }
    const selectionRevision = tab.selectionRevision || 0;
    const listResult = await loadNavList(false);
    if (activeTab() !== tab || tab.pageId !== pageId || (tab.selectionRevision || 0) !== selectionRevision) return;
    if (viewMode === "gallery") {
      await renderGalleryForCurrentPage();
    } else if (isSamePage && tab.currentFrameId) {
      await renderBoardOnCanvas(tab.currentFrameId, tab.selectedNodeId || tab.currentFrameId);
    } else if (listResult?.items?.length) {
      const firstId = listResult.items[0].id;
      await selectNodeAndRender(firstId, true);
    } else {
      $("board-wrap").hidden = true;
      $("canvas-empty").hidden = false;
      $("empty-title").textContent = "此页面暂无标准尺寸画板";
      $("empty-subtitle").textContent = "可切换至左侧「图层树」浏览全部子节点";
    }
  }

  function updateNavTabButtons() {
    const tab = activeTab();
    const current = tab ? tab.navTab : "frames";
    for (const [id, key] of [
      ["tab-frames", "frames"],
      ["tab-layers", "layers"],
      ["tab-assets", "assets"]
    ]) {
      const active = current === key;
      $(id).classList.toggle("active", active);
      $(id).setAttribute("aria-selected", String(active));
    }
  }

  function renderLayerBreadcrumbs() {
    const tab = activeTab();
    const box = $("layer-breadcrumbs");
    box.replaceChildren();
    if (!tab || tab.navTab !== "layers" || $("search-input").value.trim()) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    tab.layerTrail.forEach((crumb, idx) => {
      const btn = document.createElement("button");
      btn.textContent = crumb.name;
      btn.title = crumb.name;
      btn.addEventListener("click", () => {
        tab.layerTrail = tab.layerTrail.slice(0, idx + 1);
        loadNavList(false).catch(showError);
      });
      box.appendChild(btn);
      if (idx < tab.layerTrail.length - 1) {
        const sep = document.createElement("span");
        sep.textContent = "›";
        box.appendChild(sep);
      }
    });
  }

  async function loadNavList(append = false) {
    const tab = activeTab();
    if (!tab) return null;
    updateNavTabButtons();
    renderLayerBreadcrumbs();

    const listEl = $("nav-list");
    if (!append) listEl.replaceChildren();
    $("btn-load-more").hidden = true;

    const query = $("search-input").value.trim();
    if (query) {
      const res = await callWorker("search", {
        docId: tab.docId,
        query,
        pageId: tab.pageId,
        allPages: $("search-all-pages").checked,
        includeInternal: $("include-internal").checked,
        offset: append ? tab.nextOffset : 0,
        limit: 100
      });
      tab.nextOffset = res.nextOffset;
      renderNodeRows(res.items, true);
      $("btn-load-more").hidden = res.nextOffset === null;
      return res;
    }

    if (tab.navTab === "assets") {
      const res = await callWorker("listAssets", { docId: tab.docId });
      renderAssetRows(res.items);
      return res;
    }

    if (tab.navTab === "layers") {
      const parentId = tab.layerTrail.at(-1)?.id || tab.pageId;
      const res = await callWorker("children", {
        docId: tab.docId,
        nodeId: parentId,
        offset: append ? tab.nextOffset : 0,
        limit: 120
      });
      tab.nextOffset = res.nextOffset;
      $("count-layers").textContent = `(${res.total})`;
      renderNodeRows(res.items, false);
      $("btn-load-more").hidden = res.nextOffset === null;
      return res;
    }

    // Default: frames
    const res = await callWorker("frames", {
      docId: tab.docId,
      pageId: tab.pageId,
      offset: append ? tab.nextOffset : 0,
      limit: 120
    });
    tab.nextOffset = res.nextOffset;
    $("count-frames").textContent = `(${res.total})`;
    renderNodeRows(res.items, false);
    $("btn-load-more").hidden = res.nextOffset === null;
    return res;
  }

  function renderNodeRows(items, isSearchResult) {
    const tab = activeTab();
    const listEl = $("nav-list");
    if (!items.length && !listEl.children.length) {
      const empty = document.createElement("div");
      empty.className = "muted-empty";
      empty.textContent = isSearchResult ? "未找到匹配的画板或文案" : "当前列表为空";
      listEl.appendChild(empty);
      return;
    }

    for (const item of items) {
      const row = document.createElement("div");
      row.className = "node-item" + (item.id === tab?.selectedNodeId ? " selected" : "");
      row.dataset.id = item.id;

      const main = document.createElement("div");
      main.className = "node-item-main";

      const titleLine = document.createElement("div");
      titleLine.className = "node-item-title";
      const badge = document.createElement("span");
      badge.className = "type-badge";
      badge.textContent = item.type;
      const nameSpan = document.createElement("span");
      nameSpan.textContent = item.name || item.type;
      titleLine.append(badge, nameSpan);

      const metaLine = document.createElement("div");
      metaLine.className = "node-item-meta";
      const parts = [];
      if (isSearchResult && item.pageName) parts.push(item.pageName);
      if (isSearchResult && item.frameName && item.frameName !== item.name) {
        parts.push(item.frameName);
      }
      if (item.size) parts.push(`${fmtNum(item.size.x)} × ${fmtNum(item.size.y)}`);
      if (item.text) parts.push(`“${item.text.slice(0, 40)}”`);
      else if (item.overrideText) parts.push(`“${item.overrideText.slice(0, 40)}”`);
      metaLine.textContent = parts.join(" · ");

      main.append(titleLine, metaLine);
      row.appendChild(main);

      if (tab?.navTab === "layers" && !isSearchResult && item.childCount > 0) {
        const drill = document.createElement("button");
        drill.className = "drill-btn";
        drill.textContent = `子层 (${item.childCount}) ›`;
        drill.title = "展开查看子图层";
        drill.addEventListener("click", (ev) => {
          ev.stopPropagation();
          tab.layerTrail.push({ id: item.id, name: item.name || item.type });
          loadNavList(false).catch(showError);
        });
        row.appendChild(drill);
      }

      row.addEventListener("click", () => {
        onSelectRowItem(item, isSearchResult).catch(showError);
      });
      listEl.appendChild(row);
    }
  }

  function renderAssetRows(assets) {
    const listEl = $("nav-list");
    listEl.replaceChildren();
    if (!assets.length) {
      const empty = document.createElement("div");
      empty.className = "muted-empty";
      empty.textContent = "此 .fig 文件未包含内嵌位图资源 (images/*)。";
      listEl.appendChild(empty);
      return;
    }

    for (const asset of assets) {
      const card = document.createElement("div");
      card.className = "asset-card";

      const info = document.createElement("div");
      info.className = "asset-info";
      const hashEl = document.createElement("div");
      hashEl.className = "asset-hash";
      hashEl.textContent = asset.hash;
      hashEl.title = asset.hash;

      const metaEl = document.createElement("div");
      metaEl.className = "asset-meta";
      const dim = asset.width && asset.height ? `${asset.width}×${asset.height} · ` : "";
      metaEl.textContent = `${asset.ext.toUpperCase()} · ${dim}${formatBytes(asset.byteLength)}`;
      info.append(hashEl, metaEl);

      const btnGroup = document.createElement("div");
      btnGroup.style.display = "flex";
      btnGroup.style.gap = "4px";

      const previewBtn = document.createElement("button");
      previewBtn.className = "btn-xs";
      previewBtn.textContent = "预览";
      previewBtn.addEventListener("click", () => previewAssetInCanvas(asset.hash).catch(showError));

      const saveBtn = document.createElement("button");
      saveBtn.className = "btn-xs";
      saveBtn.textContent = "无损提取";
      saveBtn.title = "1:1 零重编码提取原图字节流";
      saveBtn.addEventListener("click", () => extractAssetLossless(asset.hash).catch(showError));

      btnGroup.append(previewBtn, saveBtn);
      card.append(info, btnGroup);
      listEl.appendChild(card);
    }
  }

  async function previewAssetInCanvas(hash) {
    const tab = activeTab();
    if (!tab) return;
    tab.selectionRevision = (tab.selectionRevision || 0) + 1;
    const renderRevision = tab.renderRevision = (tab.renderRevision || 0) + 1;
    const data = await callWorker("getAssetData", { docId: tab.docId, hash });
    if (activeTab() !== tab || tab.renderRevision !== renderRevision) return;
    const img = $("preview-img");
    img.src = data.dataUri;
    await img.decode();
    if (activeTab() !== tab || tab.renderRevision !== renderRevision) return;
    tab.currentFrameId = null;
    tab.nativeWidth = data.width || img.naturalWidth || 400;
    tab.nativeHeight = data.height || img.naturalHeight || 400;
    tab.hitBoxes = [];
    selectedHitBox = null;
    hoveredHitBox = null;
    renderHitOverlay();
    $("btn-export-svg").disabled = true;
    $("btn-export-png").disabled = false;
    $("btn-export-html").disabled = true;
    $("gallery-view").hidden = true;
    $("canvas-empty").hidden = true;
    $("board-wrap").hidden = false;
    $("current-frame-title").textContent = `原图资源 ${hash.slice(0, 12)}... (${data.ext.toUpperCase()})`;
    $("dimensions-readout").textContent = `${tab.nativeWidth} × ${tab.nativeHeight} px · ${formatBytes(data.byteLength)}`;
    fitCanvasToViewport();
  }

  async function extractAssetLossless(hash) {
    const tab = activeTab();
    if (!tab) return;
    const data = await callWorker("getAssetData", { docId: tab.docId, hash });
    const fileName = `FigFig-Asset-${hash.slice(0, 12)}.${data.ext}`;
    await saveBase64File(fileName, data.base64, data.mime, `${data.ext.toUpperCase()} 原图|*.${data.ext}`);
    setStatus(`已 1:1 无损提取原图 ${fileName} (${formatBytes(data.byteLength)})`);
  }

  async function onSelectRowItem(item, isSearchResult) {
    const tab = activeTab();
    if (!tab) return;
    if (viewMode === "gallery") {
      setViewMode("canvas");
    }
    if (isSearchResult && item.pageId && item.pageId !== tab.pageId) {
      $("page-select").value = item.pageId;
      tab.pageId = item.pageId;
    }
    await selectNodeAndRender(item.id, true);
  }

  async function selectNodeAndRender(nodeId, renderBoardIfNeeded = true) {
    const tab = activeTab();
    if (!tab) return;
    const selectionRevision = tab.selectionRevision = (tab.selectionRevision || 0) + 1;
    tab.renderRevision = (tab.renderRevision || 0) + 1;
    tab.selectedNodeId = nodeId;
    for (const row of document.querySelectorAll(".node-item")) {
      row.classList.toggle("selected", row.dataset.id === nodeId);
    }

    const detail = await callWorker("node", { docId: tab.docId, nodeId });
    if (activeTab() !== tab || tab.selectionRevision !== selectionRevision) return;
    currentNodeDetail = detail;
    renderInspector(detail);

    $("btn-copy-css").disabled = false;
    $("btn-copy-text").disabled = !detail.text;
    $("btn-copy-json").disabled = false;

    const targetFrameId = detail.enclosingFrameId || nodeId;
    if (renderBoardIfNeeded && targetFrameId && targetFrameId !== tab.currentFrameId) {
      await renderBoardOnCanvas(targetFrameId, nodeId);
      if (activeTab() !== tab || tab.selectionRevision !== selectionRevision) return;
      if (nodeId !== targetFrameId) {
        const refreshed = await callWorker("node", { docId: tab.docId, nodeId });
        if (activeTab() !== tab || tab.selectionRevision !== selectionRevision) return;
        currentNodeDetail = refreshed;
        renderInspector(refreshed);
        $("btn-copy-text").disabled = !refreshed.text;
      }
    } else {
      // Just highlight the selected node inside the already rendered frame
      highlightSelectedNodeInHitMap(nodeId);
    }
  }

  async function renderBoardOnCanvas(frameId, highlightNodeId = null) {
    const tab = activeTab();
    if (!tab) return;
    const renderRevision = tab.renderRevision = (tab.renderRevision || 0) + 1;
    setStatus(`正在矢量渲染画板...`);
    try {
      const rendered = await callWorker("render", {
        docId: tab.docId,
        nodeId: frameId,
        useGlyphOutlines
      });
      if (activeTab() !== tab || tab.renderRevision !== renderRevision) return;
      const img = $("preview-img");
      img.src = rendered.uri;
      await img.decode();
      if (activeTab() !== tab || tab.renderRevision !== renderRevision) return;

      tab.currentFrameId = frameId;
      tab.nativeWidth = rendered.width;
      tab.nativeHeight = rendered.height;
      tab.hitBoxes = rendered.hitBoxes || [];

      $("canvas-empty").hidden = true;
      $("gallery-view").hidden = true;
      $("board-wrap").hidden = false;
      $("current-frame-title").textContent = rendered.name;
      $("render-perf-badge").hidden = false;
      $("render-perf-badge").textContent = `${rendered.renderMs} ms · ${rendered.visited} 节点`;
      $("dimensions-readout").textContent = `${rendered.width} × ${rendered.height} px`;
      $("btn-export-svg").disabled = false;
      $("btn-export-png").disabled = false;
      $("btn-export-html").disabled = false;

      fitCanvasToViewport();
      highlightSelectedNodeInHitMap(highlightNodeId || frameId);

      setStatus(
        `画板「${rendered.name}」渲染完成 (${rendered.renderMs} ms) · ${rendered.visited} 个节点 · ${rendered.outlinedText} 处字形轮廓`
      );
      document.body.dataset.ready = "true";
    } catch (err) {
      showError(err);
    }
  }

  function highlightSelectedNodeInHitMap(nodeId) {
    const tab = activeTab();
    if (!tab || !tab.hitBoxes.length) {
      selectedHitBox = null;
      renderHitOverlay();
      return;
    }
    selectedHitBox = tab.hitBoxes.find((b) => b.id === nodeId || b.sourceId === nodeId) || null;
    renderHitOverlay();
  }

  // Interactive Hit-Testing & Smart Distance Measurement Overlay
  function renderHitOverlay() {
    const tab = activeTab();
    const svg = $("hit-overlay");
    svg.replaceChildren();
    if (!tab || !tab.nativeWidth || !tab.nativeHeight) return;

    svg.setAttribute("viewBox", `0 0 ${tab.nativeWidth} ${tab.nativeHeight}`);
    const invScale = 1 / Math.max(0.05, tab.scale);
    const strokeW = Math.max(1, 1.5 * invScale);

    const ns = "http://www.w3.org/2000/svg";

    // 1. Selected Box (#3b82f6)
    if (selectedHitBox && selectedHitBox.id !== tab.currentFrameId) {
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", String(selectedHitBox.x));
      rect.setAttribute("y", String(selectedHitBox.y));
      rect.setAttribute("width", String(selectedHitBox.w));
      rect.setAttribute("height", String(selectedHitBox.h));
      rect.setAttribute("fill", "rgba(59, 130, 246, 0.06)");
      rect.setAttribute("stroke", "#3b82f6");
      rect.setAttribute("stroke-width", String(strokeW));
      svg.appendChild(rect);
    }

    // 2. Hovered Box (#10b981)
    if (hoveredHitBox && hoveredHitBox.id !== selectedHitBox?.id) {
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", String(hoveredHitBox.x));
      rect.setAttribute("y", String(hoveredHitBox.y));
      rect.setAttribute("width", String(hoveredHitBox.w));
      rect.setAttribute("height", String(hoveredHitBox.h));
      rect.setAttribute("fill", "rgba(16, 185, 129, 0.08)");
      rect.setAttribute("stroke", "#10b981");
      rect.setAttribute("stroke-width", String(strokeW));
      rect.setAttribute("stroke-dasharray", `${4 * invScale} ${2 * invScale}`);
      svg.appendChild(rect);
    }

    // 3. Smart Distance Guides (between selectedHitBox and hoveredHitBox)
    if (
      selectedHitBox &&
      hoveredHitBox &&
      selectedHitBox.id !== hoveredHitBox.id &&
      (measureEnabled || window.__altPressed)
    ) {
      drawDistanceGuides(svg, selectedHitBox, hoveredHitBox, invScale);
    }
  }

  function drawDistanceGuides(svg, a, b, invScale) {
    const ns = "http://www.w3.org/2000/svg";
    const strokeW = Math.max(1, 1.4 * invScale);
    const fontSize = Math.max(10, 11 * invScale);

    function addLineWithLabel(x1, y1, x2, y2, dist) {
      const rounded = Math.round(dist);
      if (rounded <= 0) return;
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", String(x1));
      line.setAttribute("y1", String(y1));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(y2));
      line.setAttribute("stroke", "#f43f5e");
      line.setAttribute("stroke-width", String(strokeW));
      svg.appendChild(line);

      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const labelText = `${rounded}px`;
      const pillW = (labelText.length * 6.5 + 10) * invScale;
      const pillH = 18 * invScale;

      const bg = document.createElementNS(ns, "rect");
      bg.setAttribute("x", String(mx - pillW / 2));
      bg.setAttribute("y", String(my - pillH / 2));
      bg.setAttribute("width", String(pillW));
      bg.setAttribute("height", String(pillH));
      bg.setAttribute("rx", String(3 * invScale));
      bg.setAttribute("fill", "#f43f5e");
      svg.appendChild(bg);

      const txt = document.createElementNS(ns, "text");
      txt.setAttribute("x", String(mx));
      txt.setAttribute("y", String(my + fontSize * 0.34));
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("fill", "#ffffff");
      txt.setAttribute("font-size", String(fontSize));
      txt.setAttribute("font-family", "Consolas, sans-serif");
      txt.textContent = labelText;
      svg.appendChild(txt);
    }

    const aRight = a.x + a.w;
    const aBottom = a.y + a.h;
    const bRight = b.x + b.w;
    const bBottom = b.y + b.h;
    const aCx = a.x + a.w / 2;
    const aCy = a.y + a.h / 2;

    // Horizontal gap
    if (b.x > aRight) {
      addLineWithLabel(aRight, aCy, b.x, aCy, b.x - aRight);
    } else if (a.x > bRight) {
      addLineWithLabel(bRight, aCy, a.x, aCy, a.x - bRight);
    }

    // Vertical gap
    if (b.y > aBottom) {
      addLineWithLabel(aCx, aBottom, aCx, b.y, b.y - aBottom);
    } else if (a.y > bBottom) {
      addLineWithLabel(aCx, bBottom, aCx, a.y, a.y - bBottom);
    }
  }

  function findHitBoxAt(fx, fy) {
    const tab = activeTab();
    if (!tab || !tab.hitBoxes.length) return null;
    // Find smallest-area / deepest node containing (fx, fy)
    let best = null;
    let bestScore = Infinity;
    for (let i = tab.hitBoxes.length - 1; i >= 0; i--) {
      const box = tab.hitBoxes[i];
      if (box.id === tab.currentFrameId) continue;
      if (fx >= box.x && fx <= box.x + box.w && fy >= box.y && fy <= box.y + box.h) {
        const area = box.w * box.h;
        // Prefer deeper nodes with smaller area
        const score = area / Math.pow(box.depth + 1, 1.5);
        if (score < bestScore) {
          bestScore = score;
          best = box;
        }
      }
    }
    return best;
  }

  $("hit-overlay").addEventListener("mousemove", (ev) => {
    const tab = activeTab();
    if (!tab || !inspectEnabled || isPanning) return;
    const rect = $("hit-overlay").getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const fx = ((ev.clientX - rect.left) / rect.width) * tab.nativeWidth;
    const fy = ((ev.clientY - rect.top) / rect.height) * tab.nativeHeight;
    const hit = findHitBoxAt(fx, fy);
    if (hit?.id !== hoveredHitBox?.id) {
      hoveredHitBox = hit;
      renderHitOverlay();
      $("hover-readout").textContent = hit
        ? `${hit.name} (${hit.type}) · ${fmtNum(hit.w)} × ${fmtNum(hit.h)}`
        : "";
    }
  });

  $("hit-overlay").addEventListener("mouseleave", () => {
    hoveredHitBox = null;
    $("hover-readout").textContent = "";
    renderHitOverlay();
  });

  $("hit-overlay").addEventListener("click", (ev) => {
    const tab = activeTab();
    if (!tab || !inspectEnabled || isPanning) return;
    const rect = $("hit-overlay").getBoundingClientRect();
    const fx = ((ev.clientX - rect.left) / rect.width) * tab.nativeWidth;
    const fy = ((ev.clientY - rect.top) / rect.height) * tab.nativeHeight;
    const hit = findHitBoxAt(fx, fy);
    if (hit) {
      selectNodeAndRender(hit.id, false).catch(showError);
    } else if (tab.currentFrameId) {
      selectNodeAndRender(tab.currentFrameId, false).catch(showError);
    }
  });

  // Zoom & Pan
  function syncViewportFitClass() {
    const tab = activeTab();
    const isFittedCanvas = Boolean(tab?.fitted && viewMode === "canvas");
    $("viewport").classList.toggle("is-fitted", isFittedCanvas);
  }

  function applyScale(newScale, anchorClientX = null, anchorClientY = null) {
    const tab = activeTab();
    if (!tab || !tab.nativeWidth || !tab.nativeHeight) return;
    const viewport = $("viewport");
    const oldScale = tab.scale;
    const clamped = Math.min(16, Math.max(0.05, newScale));
    tab.scale = clamped;
    syncViewportFitClass();

    $("zoom-input").value = String(Math.round(clamped * 100));
    const wrap = $("board-wrap");
    const targetW = Math.max(1, Math.floor(tab.nativeWidth * clamped));
    const targetH = Math.max(1, Math.floor(tab.nativeHeight * clamped));
    wrap.style.width = `${targetW}px`;
    wrap.style.height = `${targetH}px`;

    if (anchorClientX !== null && anchorClientY !== null && oldScale > 0) {
      const vpRect = viewport.getBoundingClientRect();
      const offsetX = anchorClientX - vpRect.left + viewport.scrollLeft;
      const offsetY = anchorClientY - vpRect.top + viewport.scrollTop;
      const ratio = clamped / oldScale;
      viewport.scrollLeft = offsetX * ratio - (anchorClientX - vpRect.left);
      viewport.scrollTop = offsetY * ratio - (anchorClientY - vpRect.top);
    }
    renderHitOverlay();
  }

  function fitCanvasToViewport() {
    const tab = activeTab();
    if (!tab || !tab.nativeWidth || !tab.nativeHeight) return;
    tab.fitted = true;
    const viewport = $("viewport");
    syncViewportFitClass();
    const rect = viewport.getBoundingClientRect();
    const pad = 64;
    const availW = Math.max(120, Math.floor(rect.width) - pad);
    const availH = Math.max(120, Math.floor(rect.height) - pad);
    const nextScale = Math.min(1, availW / tab.nativeWidth, availH / tab.nativeHeight);
    applyScale(nextScale);
    viewport.scrollTo(0, 0);
  }

  $("viewport").addEventListener(
    "wheel",
    (ev) => {
      if (viewMode !== "canvas") return;
      ev.preventDefault();
      const tab = activeTab();
      if (!tab) return;
      tab.fitted = false;
      const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      applyScale(tab.scale * factor, ev.clientX, ev.clientY);
    },
    { passive: false }
  );

  $("viewport").addEventListener("mousedown", (ev) => {
    if (ev.button === 1 || (ev.button === 0 && isSpaceDown)) {
      ev.preventDefault();
      isPanning = true;
      const vp = $("viewport");
      vp.classList.add("panning");
      panStart = {
        x: ev.clientX,
        y: ev.clientY,
        scrollLeft: vp.scrollLeft,
        scrollTop: vp.scrollTop
      };
    }
  });

  window.addEventListener("mousemove", (ev) => {
    if (!isPanning) return;
    const vp = $("viewport");
    vp.scrollLeft = panStart.scrollLeft - (ev.clientX - panStart.x);
    vp.scrollTop = panStart.scrollTop - (ev.clientY - panStart.y);
  });

  window.addEventListener("mouseup", () => {
    if (isPanning) {
      isPanning = false;
      $("viewport").classList.remove("panning");
    }
  });

  // Gallery View Mode
  async function setViewMode(mode) {
    viewMode = mode;
    syncViewportFitClass();
    $("mode-canvas").classList.toggle("active", mode === "canvas");
    $("mode-gallery").classList.toggle("active", mode === "gallery");
    if (mode === "gallery") {
      $("stage").hidden = true;
      $("canvas-empty").hidden = true;
      $("gallery-view").hidden = false;
      await renderGalleryForCurrentPage();
    } else {
      $("gallery-view").hidden = true;
      $("stage").hidden = false;
      const tab = activeTab();
      if (tab?.currentFrameId) {
        $("board-wrap").hidden = false;
      }
    }
  }

  async function renderGalleryForCurrentPage(append = false) {
    const tab = activeTab();
    if (!tab || !tab.pageId) return;
    const gallery = $("gallery-view");
    if (!append) {
      tab.galleryOffset = 0;
      gallery.innerHTML = '<div class="muted-empty">正在生成当前页画板总览缩略图...</div>';
    }
    const framesRes = await callWorker("frames", {
      docId: tab.docId,
      pageId: tab.pageId,
      offset: tab.galleryOffset || 0,
      limit: 24
    });
    if (!framesRes.items.length && !append) {
      gallery.innerHTML = '<div class="muted-empty">当前页面没有可总览的画板。</div>';
      return;
    }
    const batch = await callWorker("batchThumbnails", {
      docId: tab.docId,
      nodeIds: framesRes.items.map((f) => f.id),
      useGlyphOutlines
    });
    if (!append) gallery.replaceChildren();
    else gallery.querySelector(".gallery-more-btn")?.remove();

    for (const item of batch.items) {
      if (item.error) continue;
      const card = document.createElement("div");
      card.className = "gallery-card";
      const thumb = document.createElement("div");
      thumb.className = "gallery-thumb";
      const img = document.createElement("img");
      img.src = item.uri;
      img.alt = item.name;
      thumb.appendChild(img);

      const meta = document.createElement("div");
      meta.className = "gallery-meta";
      const title = document.createElement("strong");
      title.textContent = item.name;
      const dim = document.createElement("small");
      dim.textContent = `${item.width}×${item.height} · ${item.renderMs}ms`;
      meta.append(title, dim);

      card.append(thumb, meta);
      card.addEventListener("click", () => {
        setViewMode("canvas");
        selectNodeAndRender(item.id, true).catch(showError);
      });
      gallery.appendChild(card);
    }

    tab.galleryOffset = framesRes.nextOffset;
    if (framesRes.nextOffset !== null) {
      const moreBtn = document.createElement("button");
      moreBtn.className = "btn gallery-more-btn";
      moreBtn.style.gridColumn = "1 / -1";
      moreBtn.style.justifySelf = "center";
      moreBtn.textContent = `加载更多画板缩略图 (${framesRes.nextOffset} / ${framesRes.total})...`;
      moreBtn.addEventListener("click", () => renderGalleryForCurrentPage(true).catch(showError));
      gallery.appendChild(moreBtn);
    }
  }

  // Right Inspector Rendering
  function renderInspector(node) {
    const body = $("inspector-body");
    body.replaceChildren();

    // Header Card
    const headCard = document.createElement("div");
    headCard.className = "insp-card";
    const h2 = document.createElement("div");
    h2.className = "insp-node-title";
    h2.textContent = node.type === "TEXT" && node.text ? node.text : node.name || node.type;
    const sub = document.createElement("div");
    sub.className = "insp-node-sub";
    sub.textContent = `${node.type} · ID ${node.id}`;
    headCard.append(h2, sub);

    if (node.enclosingFrameId && node.enclosingFrameId !== node.id) {
      const jumpBtn = document.createElement("button");
      jumpBtn.className = "btn-xs";
      jumpBtn.textContent = `定位所属画板 (${node.enclosingFrameId})`;
      jumpBtn.addEventListener("click", () =>
        selectNodeAndRender(node.enclosingFrameId, true).catch(showError)
      );
      headCard.appendChild(jumpBtn);
    }
    body.appendChild(headCard);

    // Geometry & Layout Card
    const geoCard = document.createElement("div");
    geoCard.className = "insp-card";
    const geoTitle = document.createElement("h3");
    geoTitle.textContent = "几何尺寸与自动布局 (Auto-Layout)";
    geoCard.appendChild(geoTitle);

    const grid = document.createElement("div");
    grid.className = "kv-grid";
    const tf = node.properties.transform || {};
    const pairs = [
      ["X", fmtNum(tf.m02)],
      ["Y", fmtNum(tf.m12)],
      ["W", fmtNum(node.size?.x)],
      ["H", fmtNum(node.size?.y)],
      ["圆角", fmtNum(node.properties.cornerRadius ?? 0)],
      ["不透明度", `${Math.round((node.properties.opacity ?? 1) * 100)}%`]
    ];
    if (node.properties.stackMode && node.properties.stackMode !== "NONE") {
      pairs.push(["布局方向", node.properties.stackMode]);
      pairs.push(["间距 Gap", `${fmtNum(node.properties.stackSpacing ?? 0)}px`]);
    }
    for (const [k, v] of pairs) {
      const cell = document.createElement("div");
      cell.className = "kv-item";
      const s = document.createElement("small");
      s.textContent = k;
      const val = document.createElement("span");
      val.textContent = v;
      cell.append(s, val);
      grid.appendChild(cell);
    }
    geoCard.appendChild(grid);
    body.appendChild(geoCard);

    // Text Card
    if (node.text) {
      const txtCard = document.createElement("div");
      txtCard.className = "insp-card";
      const tHead = document.createElement("h3");
      tHead.innerHTML = `<span>文字内容 (${node.cachedGlyphs} 字形轮廓)</span>`;
      const copyBtn = document.createElement("button");
      copyBtn.className = "btn-xs";
      copyBtn.textContent = "复制";
      copyBtn.addEventListener("click", () => copyTextToClipboard(node.text, "文案已复制"));
      tHead.appendChild(copyBtn);

      const box = document.createElement("div");
      box.className = "text-preview-box";
      box.textContent = node.text;
      txtCard.append(tHead, box);
      body.appendChild(txtCard);
    }

    // Fills & Strokes Card
    if (node.parsedFills?.length || node.parsedStrokes?.length) {
      const colorCard = document.createElement("div");
      colorCard.className = "insp-card";
      const cHead = document.createElement("h3");
      cHead.textContent = "填充与描边色值 (点击复制)";
      colorCard.appendChild(cHead);

      for (const fill of node.parsedFills || []) {
        const row = document.createElement("div");
        row.className = "swatch-row";
        if (fill.type === "SOLID") {
          const left = document.createElement("div");
          left.className = "swatch-left";
          const sw = document.createElement("span");
          sw.className = "color-box";
          sw.style.background = fill.hex;
          const label = document.createElement("span");
          label.textContent = `${fill.hex} · ${fill.alpha}%`;
          left.append(sw, label);
          const cp = document.createElement("button");
          cp.className = "btn-xs";
          cp.textContent = "复制 HEX";
          cp.addEventListener("click", () => copyTextToClipboard(fill.hex, `已复制色值 ${fill.hex}`));
          row.append(left, cp);
        } else if (fill.type === "IMAGE" && fill.imageHash) {
          const left = document.createElement("span");
          left.textContent = `位图填充 (${fill.imageHash.slice(0, 10)}...)`;
          const ex = document.createElement("button");
          ex.className = "btn-xs";
          ex.textContent = "提取原图";
          ex.addEventListener("click", () => extractAssetLossless(fill.imageHash).catch(showError));
          row.append(left, ex);
        } else {
          row.textContent = `${fill.type}`;
        }
        colorCard.appendChild(row);
      }

      for (const st of node.parsedStrokes || []) {
        const row = document.createElement("div");
        row.className = "swatch-row";
        const left = document.createElement("div");
        left.className = "swatch-left";
        const sw = document.createElement("span");
        sw.className = "color-box";
        sw.style.background = st.hex;
        const label = document.createElement("span");
        label.textContent = `描边 ${st.weight}px · ${st.hex}`;
        left.append(sw, label);
        const cp = document.createElement("button");
        cp.className = "btn-xs";
        cp.textContent = "复制";
        cp.addEventListener("click", () => copyTextToClipboard(st.hex, `已复制描边色值 ${st.hex}`));
        row.append(left, cp);
        colorCard.appendChild(row);
      }
      body.appendChild(colorCard);
    }

    // CSS Code Card
    if (node.cssCode) {
      const cssCard = document.createElement("div");
      cssCard.className = "insp-card";
      const head = document.createElement("h3");
      head.innerHTML = "<span>自动生成 CSS 标注代码</span>";
      const cpBtn = document.createElement("button");
      cpBtn.className = "btn-xs";
      cpBtn.textContent = "复制 CSS";
      cpBtn.addEventListener("click", () => copyTextToClipboard(node.cssCode, "CSS 代码已复制"));
      head.appendChild(cpBtn);

      const pre = document.createElement("pre");
      pre.className = "code-block";
      pre.textContent = node.cssCode;
      cssCard.append(head, pre);
      body.appendChild(cssCard);
    }

    // Component Overrides Card
    if (node.componentId || node.overrides?.total > 0) {
      const compCard = document.createElement("div");
      compCard.className = "insp-card";
      const head = document.createElement("h3");
      head.textContent = `组件实例与覆盖 (${node.overrides?.total ?? 0} 项)`;
      compCard.appendChild(head);
      if (node.componentId) {
        const jumpComp = document.createElement("button");
        jumpComp.className = "btn-xs";
        jumpComp.textContent = `跳转源组件 ${node.componentId}`;
        jumpComp.addEventListener("click", () =>
          selectNodeAndRender(node.componentId, true).catch(showError)
        );
        compCard.appendChild(jumpComp);
      }
      body.appendChild(compCard);
    }

    // Raw Kiwi Properties
    const rawCard = document.createElement("div");
    rawCard.className = "insp-card";
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.style.cursor = "pointer";
    summary.style.fontSize = "11px";
    summary.style.color = "var(--text-muted)";
    summary.textContent = "展开当前实例属性 JSON";
    const rawPre = document.createElement("pre");
    rawPre.className = "code-block";
    rawPre.style.marginTop = "8px";
    rawPre.textContent = JSON.stringify(node.properties, null, 2);
    details.append(summary, rawPre);
    rawCard.appendChild(details);
    body.appendChild(rawCard);
  }

  async function copyTextToClipboard(text, message) {
    try {
      if (isNativeHost) {
        await callHost("copyText", { text });
      } else {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          document.body.appendChild(textarea);
          textarea.select();
          let copied;
          try { copied = document.execCommand("copy"); } finally { textarea.remove(); }
          if (!copied) throw new Error("复制失败，请检查剪贴板是否被其他程序占用。");
        }
      }
      setStatus(message || "已复制到剪贴板");
      return true;
    } catch (error) {
      showError(error);
      return false;
    }
  }

  // Export workflows
  async function saveBase64File(fileName, base64Data, mimeType, filterSpec) {
    if (isNativeHost) {
      const saved = await callHost("saveFile", {
        fileName,
        base64: base64Data,
        filter: filterSpec || "All files|*.*"
      });
      return saved;
    }
    const bin = atob(base64Data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    return { name: fileName };
  }

  async function exportCurrentBoardSvg() {
    const tab = activeTab();
    if (!tab || !tab.currentFrameId) return;
    setStatus("正在生成兼容预览 SVG...");
    const res = await callWorker("exportSvg", {
      docId: tab.docId,
      nodeId: tab.currentFrameId,
      useGlyphOutlines
    });
    const safeName = (res.name || "Frame").replace(/[\\/:*?"<>|]/g, "_");
    const svgBytes = new TextEncoder().encode(res.svg);
    let binary = "";
    for (let i = 0; i < svgBytes.length; i++) binary += String.fromCharCode(svgBytes[i]);
    const b64 = btoa(binary);
    const out = await saveBase64File(
      `${safeName}.svg`,
      b64,
      "image/svg+xml",
      "SVG 矢量文件|*.svg"
    );
    setStatus(out ? `已导出 ${safeName}.svg（兼容预览）` : "已取消导出");
  }

  async function exportCurrentBoardHtml() {
    const tab = activeTab();
    if (!tab?.currentFrameId) return;
    setStatus("正在生成原尺寸 HTML...");
    const rendered = await callWorker("exportSvg", { docId: tab.docId, nodeId: tab.currentFrameId, useGlyphOutlines });
    const safeName = (rendered.name || "Frame").replace(/[\\/:*?"<>|]/g, "_");
    const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    const asBase64 = (value) => {
      const bytes = new TextEncoder().encode(value);
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      return btoa(binary);
    };
    const width = rendered.width;
    const height = rendered.height;
    const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="generator" content="FigFig">
<meta name="figfig-source-sha256" content="${escape(tab.summary.sha256 || "")}">
<title>${escape(rendered.name || "Frame")}</title>
<style>html{background:#eef0f4}body{margin:0;width:${width}px;min-height:${height}px}img{display:block;width:${width}px;height:${height}px;max-width:none}</style>
</head>
<body><img width="${width}" height="${height}" alt="${escape(rendered.name || "Frame")}" src="data:image/svg+xml;base64,${asBase64(rendered.svg)}"></body>
</html>`;
    const out = await saveBase64File(`${safeName}.html`, asBase64(html), "text/html;charset=utf-8", "HTML 离线画板|*.html");
    setStatus(out ? `已导出原尺寸 HTML (${width}×${height} px)` : "已取消导出");
  }

  function getPngExportDimensions(width, height, requestedScale) {
    if (![width, height, requestedScale].every((value) => Number.isFinite(value) && value > 0)) throw new Error("无效的 PNG 导出尺寸。");
    const scale = Math.min(requestedScale, 16384 / width, 16384 / height, Math.sqrt((32 * 1024 * 1024) / (width * height)));
    return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale, limited: scale < requestedScale };
  }

  async function exportCurrentBoardPng() {
    const tab = activeTab();
    if (!tab || !tab.nativeWidth || !tab.nativeHeight) return;
    const scaleFactor = Number($("png-scale-select").value) || 2;
    const dimensions = getPngExportDimensions(tab.nativeWidth, tab.nativeHeight, scaleFactor);
    const frameName = $("current-frame-title").textContent;
    const img = new Image();
    img.src = $("preview-img").src;
    setStatus(`正在生成 PNG (${dimensions.width}×${dimensions.height} px)...`);
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    const b64 = dataUrl.split(",")[1];
    const safeName = (frameName || "Frame").replace(
      /[\\/:*?"<>|]/g,
      "_"
    );
    const out = await saveBase64File(
      `${safeName}@${dimensions.limited ? dimensions.scale.toFixed(3) : scaleFactor}x.png`,
      b64,
      "image/png",
      "PNG 高清图像|*.png"
    );
    setStatus(
      out
        ? `已导出 PNG (${canvas.width}×${canvas.height} px)${dimensions.limited ? " · 已按比例降低倍率至安全尺寸" : ""}`
        : "已取消导出"
    );
  }

  // Integrity & Compatibility Report Dialog
  async function openIntegrityReport() {
    const tab = activeTab();
    if (!tab) return;
    const report = await callWorker("compatibility", { docId: tab.docId });
    const box = $("report-body");
    box.replaceChildren();

    const rows = [
      ["文件名称", tab.summary.fileName],
      ["文件体积", `${formatBytes(report.byteLength)} (${report.byteLength.toLocaleString()} 字节)`],
      ["源文件访问", "只读；导出不会回写 .fig 文件"],
      ["视觉一致性", "兼容预览；未完成与 Figma 官方图像的像素级一致性验证"],
      ["读取内容 SHA-256", report.sha256 || "未计算"],
      ["解析耗时", `${report.parseMs} ms`],
      ["总节点 / 内嵌原图", `${tab.summary.nodeCount.toLocaleString()} 个节点 / ${tab.summary.imageCount} 张内嵌图像`],
      ["缓存矢量字形覆盖率", `${report.totalGlyphOutlines} / ${report.totalTextNodes} 个文本节点内置字形轮廓`]
    ];

    for (const [k, v] of rows) {
      const r = document.createElement("div");
      r.className = "shortcut-row";
      r.style.marginBottom = "6px";
      const left = document.createElement("strong");
      left.textContent = k;
      const right = document.createElement("span");
      right.style.fontFamily = "Consolas, monospace";
      right.style.fontSize = "11.5px";
      right.textContent = v;
      r.append(left, right);
      box.appendChild(r);
    }

    if (report.warnings?.length) {
      const warnTitle = document.createElement("p");
      warnTitle.style.color = "var(--amber)";
      warnTitle.style.fontSize = "12px";
      warnTitle.textContent =
        "以下特征仍有渲染差异风险；没有告警也不代表视觉无损。";
      box.appendChild(warnTitle);

      const labels = {
        UNSUPPORTED_NODE: "特殊节点类型 (Video/Widget)",
        MASK_SEMANTICS: "非 Alpha 蒙版节点",
        EFFECT_APPROXIMATION: "复杂滤镜近似",
        BLEND_MODE: "特殊图层混合模式",
        UNSUPPORTED_FILL: "不支持的填充类型",
        STATIC_INTERACTIONS: "原型交互连线 (静态展示)",
        FONT_FALLBACK: "未含内置字形轮廓的文本节点 (使用系统字体回退)"
      };
      for (const w of report.warnings) {
        const r = document.createElement("div");
        r.className = "shortcut-row";
        r.style.marginBottom = "4px";
        const l = document.createElement("span");
        l.textContent = labels[w.code] || w.code;
        const c = document.createElement("kbd");
        c.textContent = `${w.count} 处`;
        r.append(l, c);
        box.appendChild(r);
      }
    }

    $("dialog-report").showModal();
  }

  // Event Bindings
  $("btn-open").addEventListener("click", async () => {
    if (isNativeHost) {
      const doc = await callHost("openDialog");
      if (doc) await openRegisteredHostDocument(doc);
    } else {
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    await openFromBytes(new Uint8Array(buf), file.name);
    fileInput.value = "";
  });

  $("btn-sample").addEventListener("click", () => {
    openFromUrl("sample-showcase.fig", "FigFig-Design-Showcase.fig").catch(showError);
  });

  $("btn-recent").addEventListener("click", async (ev) => {
    ev.stopPropagation();
    const menu = $("recent-menu");
    if (!menu.hidden) {
      menu.hidden = true;
      return;
    }
    menu.replaceChildren();
    if (isNativeHost) {
      const list = (await callHost("getQuickFiles")) || [];
      if (!list.length) {
        menu.innerHTML = '<div class="muted-empty">暂未检测到历史或下载目录中的 .fig 文件</div>';
      } else {
        for (const item of list) {
          const btn = document.createElement("button");
          btn.className = "dropdown-item";
          const st = document.createElement("strong");
          st.textContent = item.name;
          const sm = document.createElement("small");
          sm.textContent = `${formatBytes(item.byteLength)} · ${item.path}`;
          btn.append(st, sm);
          btn.addEventListener("click", async () => {
            menu.hidden = true;
            const doc = await callHost("openPath", { path: item.path });
            if (doc) await openRegisteredHostDocument(doc);
          });
          menu.appendChild(btn);
        }
      }
    } else {
      const btn = document.createElement("button");
      btn.className = "dropdown-item";
      btn.innerHTML =
        "<strong>FigFig-Design-Showcase.fig (内置示例库)</strong><small>多页面云原生工作台与设计系统组件库</small>";
      btn.addEventListener("click", () => {
        menu.hidden = true;
        openFromUrl("sample-showcase.fig", "FigFig-Design-Showcase.fig").catch(showError);
      });
      menu.appendChild(btn);
    }
    menu.hidden = false;
  });

  document.addEventListener("click", () => {
    $("recent-menu").hidden = true;
  });

  $("btn-integrity").addEventListener("click", () => openIntegrityReport().catch(showError));
  $("btn-close-report").addEventListener("click", () => $("dialog-report").close());
  $("btn-help").addEventListener("click", () => $("dialog-help").showModal());
  $("btn-close-help").addEventListener("click", () => $("dialog-help").close());

  const defaultMcpConfigText = JSON.stringify(
    {
      servers: {
        "figfig-design": {
          type: "stdio",
          command: "${workspaceFolder}/.venv/Lib/site-packages/playwright/driver/node.exe",
          args: ["${workspaceFolder}/output/figfig/mcp/server.mjs"]
        }
      }
    },
    null,
    2
  );
  if ($("mcp-vscode-code")) {
    $("mcp-vscode-code").textContent = defaultMcpConfigText;
  }
  $("btn-mcp")?.addEventListener("click", async () => {
    if (isNativeHost) {
      const cfg = await callHost("getMcpConfig").catch(() => null);
      if (cfg?.vscodeMcpJson && $("mcp-vscode-code")) {
        $("mcp-vscode-code").textContent = cfg.vscodeMcpJson;
      }
    }
    $("dialog-mcp")?.showModal();
  });
  $("btn-close-mcp")?.addEventListener("click", () => $("dialog-mcp")?.close());
  $("btn-copy-mcp-vscode")?.addEventListener("click", () => {
    copyTextToClipboard($("mcp-vscode-code")?.textContent || defaultMcpConfigText, "已复制 VS Code MCP 配置");
  });

  const themeCycle = ["light", "sepia", "dark"];
  const themeNames = { light: "浅色", sepia: "暖色", dark: "暗色" };
  function applyThemeMode(mode) {
    const valid = themeCycle.includes(mode) ? mode : "light";
    document.documentElement.setAttribute("data-theme", valid);
    if ($("theme-label")) $("theme-label").textContent = themeNames[valid];
    const iconSvg = valid === "dark" ? "figfig-dark.svg" : "figfig-light.svg";
    if ($("brand-logo-img")) $("brand-logo-img").src = iconSvg;
    if ($("empty-logo-img")) $("empty-logo-img").src = iconSvg;
    try {
      localStorage.setItem("figfig-theme", valid);
    } catch {}
    if (isNativeHost) {
      callHost("setTheme", { theme: valid }).catch(() => {});
    }
  }
  try {
    const savedTheme = localStorage.getItem("figfig-theme");
    if (savedTheme) applyThemeMode(savedTheme);
  } catch {}

  $("btn-theme").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    const next = themeCycle[(themeCycle.indexOf(cur) + 1) % themeCycle.length];
    applyThemeMode(next);
  });

  $("page-select").addEventListener("change", (ev) =>
    selectPage(ev.target.value).catch(showError)
  );
  $("include-internal").addEventListener("change", () =>
    loadPagesForActiveTab(activeTab()?.pageId).catch(showError)
  );
  $("search-all-pages").addEventListener("change", () => {
    if ($("search-input").value.trim()) loadNavList(false).catch(showError);
  });
  $("search-input").addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => loadNavList(false).catch(showError), 140);
  });

  for (const [id, tabKey] of [
    ["tab-frames", "frames"],
    ["tab-layers", "layers"],
    ["tab-assets", "assets"]
  ]) {
    $(id).addEventListener("click", () => {
      const tab = activeTab();
      if (!tab) return;
      tab.navTab = tabKey;
      $("search-input").value = "";
      loadNavList(false).catch(showError);
    });
  }

  $("btn-load-more").addEventListener("click", () => loadNavList(true).catch(showError));

  $("mode-canvas").addEventListener("click", () => setViewMode("canvas"));
  $("mode-gallery").addEventListener("click", () => setViewMode("gallery"));

  $("toggle-inspect").addEventListener("click", () => {
    inspectEnabled = !inspectEnabled;
    $("toggle-inspect").classList.toggle("active", inspectEnabled);
    if (!inspectEnabled) {
      hoveredHitBox = null;
      renderHitOverlay();
    }
  });

  $("toggle-measure").addEventListener("click", () => {
    measureEnabled = !measureEnabled;
    $("toggle-measure").classList.toggle("active", measureEnabled);
    renderHitOverlay();
  });

  $("toggle-glyphs").addEventListener("click", () => {
    useGlyphOutlines = !useGlyphOutlines;
    $("toggle-glyphs").classList.toggle("active", useGlyphOutlines);
    const tab = activeTab();
    if (tab?.currentFrameId) {
      renderBoardOnCanvas(tab.currentFrameId, tab.selectedNodeId).catch(showError);
    }
  });

  $("btn-zoom-in").addEventListener("click", () => {
    const tab = activeTab();
    if (tab) {
      tab.fitted = false;
      applyScale(tab.scale * 1.25);
    }
  });
  $("btn-zoom-out").addEventListener("click", () => {
    const tab = activeTab();
    if (tab) {
      tab.fitted = false;
      applyScale(tab.scale / 1.25);
    }
  });
  $("btn-zoom-100").addEventListener("click", () => {
    const tab = activeTab();
    if (tab) {
      tab.fitted = false;
      applyScale(1);
    }
  });
  $("btn-zoom-fit").addEventListener("click", fitCanvasToViewport);
  $("zoom-input").addEventListener("change", (ev) => {
    const val = Number(ev.target.value);
    if (val > 0) {
      const tab = activeTab();
      if (tab) {
        tab.fitted = false;
        applyScale(val / 100);
      }
    }
  });

  $("btn-export-svg").addEventListener("click", () => exportCurrentBoardSvg().catch(showError));
  $("btn-export-png").addEventListener("click", () => exportCurrentBoardPng().catch(showError));
  $("btn-export-html").addEventListener("click", () => exportCurrentBoardHtml().catch(showError));

  $("btn-copy-css").addEventListener("click", () => {
    if (currentNodeDetail?.cssCode) {
      copyTextToClipboard(currentNodeDetail.cssCode, "已复制节点 CSS 代码");
    }
  });
  $("btn-copy-text").addEventListener("click", () => {
    if (currentNodeDetail?.text) {
      copyTextToClipboard(currentNodeDetail.text, "已复制节点文本");
    }
  });
  $("btn-copy-json").addEventListener("click", () => {
    if (currentNodeDetail) {
      copyTextToClipboard(JSON.stringify(currentNodeDetail, null, 2), "已复制节点 JSON 数据");
    }
  });

  // Drag & Drop .fig files
  window.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    $("drop-overlay").hidden = false;
  });
  window.addEventListener("dragleave", (ev) => {
    if (ev.relatedTarget === null) {
      $("drop-overlay").hidden = true;
    }
  });
  window.addEventListener("drop", async (ev) => {
    ev.preventDefault();
    $("drop-overlay").hidden = true;
    const file = ev.dataTransfer?.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    await openFromBytes(new Uint8Array(buf), file.name).catch(showError);
  });

  // Global Keyboard Shortcuts
  window.addEventListener("keydown", (ev) => {
    if (ev.key === "Alt") {
      window.__altPressed = true;
      renderHitOverlay();
    }
    if (ev.code === "Space" && document.activeElement?.tagName !== "INPUT") {
      isSpaceDown = true;
      $("viewport").classList.add("panning");
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "o") {
      ev.preventDefault();
      $("btn-open").click();
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "f") {
      ev.preventDefault();
      $("search-input").focus();
      $("search-input").select();
    }
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key.toLowerCase() === "f") {
      fitCanvasToViewport();
    } else if (ev.key === "1") {
      $("btn-zoom-100").click();
    } else if (ev.key === "+" || ev.key === "=") {
      $("btn-zoom-in").click();
    } else if (ev.key === "-") {
      $("btn-zoom-out").click();
    } else if (ev.key.toLowerCase() === "i") {
      $("toggle-inspect").click();
    } else if (ev.key.toLowerCase() === "g") {
      setViewMode(viewMode === "canvas" ? "gallery" : "canvas");
    } else if (ev.key === "?") {
      $("dialog-help").showModal();
    }
  });

  window.addEventListener("keyup", (ev) => {
    if (ev.key === "Alt") {
      window.__altPressed = false;
      renderHitOverlay();
    }
    if (ev.code === "Space") {
      isSpaceDown = false;
      if (!isPanning) $("viewport").classList.remove("panning");
    }
  });

  let lastViewportSize = { width: 0, height: 0 };
  new ResizeObserver(() => {
    const vp = $("viewport");
    const rect = vp.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (Math.abs(w - lastViewportSize.width) < 2 && Math.abs(h - lastViewportSize.height) < 2) {
      return;
    }
    lastViewportSize = { width: w, height: h };
    const tab = activeTab();
    if (tab?.fitted && viewMode === "canvas") fitCanvasToViewport();
  }).observe($("viewport"));

  // Expose automation helper for verification tests
  window.__figfigApp = {
    openFromUrl,
    openFromBytes,
    selectNodeAndRender,
    setViewMode,
    getPngExportDimensions,
    getActiveTab: () => activeTab()
  };

  // Startup initialization
  async function startup() {
    if (isNativeHost) {
      const initData = await callHost("init");
      if (initData?.initialDoc) {
        await openRegisteredHostDocument(initData.initialDoc);
        return;
      }
    }
    // Load built-in showcase .fig on initial launch so the user gets an instant interactive canvas
    await openFromUrl("sample-showcase.fig", "FigFig-Design-Showcase.fig");
  }

  startup().catch(showError);
})();
