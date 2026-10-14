(() => {
  const legacyColumns = [
    ["original", "原图"], ["low_default", "低强度·自然调"], ["low_warm", "低强度·暖调"],
    ["low_neutral", "低强度·冷调"], ["high_default", "高强度·自然调"], ["high_warm", "高强度·暖调"],
    ["high_neutral", "高强度·冷调"],
  ];
  let columns = legacyColumns;
  const app = document.querySelector("#app");
  const fullImageCache = new Map();
  let manifest;
  let dataset = "0923";
  let query = "";
  let singleState = null;
  let compareState = null;
  let interaction = null;
  let loadSequence = 0;
  let rowObserver = null;
  const ROW_BATCH = 12;

  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[char]);
  const datasetScenes = () => manifest.datasets?.[dataset]?.scenes || [];
  const visibleScenes = () => datasetScenes().filter((scene) => (
    !query || `${String(scene.number).padStart(3,"0")} ${scene.categoryName} ${scene.sourceName}`.toLowerCase().includes(query.toLowerCase())
  ));
  const fullLabel = (key) => Object.fromEntries(columns)[key];

  function capturePosition() {
    const showcase = app.querySelector(".showcase");
    const rect = showcase.getBoundingClientRect();
    const headerHeight = columns.length === 4 ? 46 : 88;
    const cell = [...app.querySelectorAll(".index-cell")].find((cell) => cell.getBoundingClientRect().bottom > rect.top + headerHeight + 1);
    if (!cell) return null;
    const rowRect = cell.getBoundingClientRect();
    return { number: Number(cell.dataset.number), fraction: Math.max(0, (rect.top + headerHeight - rowRect.top) / rowRect.height), left: showcase.scrollLeft };
  }

  function render({ searchState = null, position = null } = {}) {
    columns = manifest.datasets[dataset].columns || legacyColumns;
    const scenes = visibleScenes();
    const anchorIndex = position ? scenes.findIndex(scene => scene.number === position.number) : -1;
    const initialCount = Math.min(scenes.length, Math.max(ROW_BATCH, Math.ceil((anchorIndex + 1) / ROW_BATCH) * ROW_BATCH));
    const total = datasetScenes().length;
    rowObserver?.disconnect();
    app.innerHTML = `<div class="app">
      <header class="topbar"><div class="brand"><h1>${esc(manifest.meta?.title || "4k离线效果／2k离线效果 · 六模式对比")}</h1></div><div class="summary"><strong>${scenes.length}</strong>/ ${total} 组</div></header>
      <div class="shell"><div class="filterbar"><div class="filter-group version-switch" role="tablist" aria-label="效果版本">${Object.entries(manifest.datasets).map(([key, value]) => `<button class="filter-chip module-chip ${dataset === key ? "active" : ""}" data-dataset="${key}" role="tab" aria-selected="${dataset === key}">${esc(value.label)}</button>`).join("")}</div><input class="search" value="${esc(query)}" placeholder="搜索序号" aria-label="搜索"/></div>
      <section class="showcase"><div class="table-grid ${columns.length === 4 ? "four-columns" : ""}" style="grid-template-columns:48px repeat(${columns.length},minmax(0,1fr))">${tableHead()}${scenes.length ? scenes.slice(0, initialCount).map(row).join("") : '<div class="empty">没有匹配的测试图片</div>'}</div><div class="load-more" aria-live="polite"></div></section></div>
      <button class="back-to-top" type="button" title="返回顶部" aria-label="返回顶部"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 8V5h14v3M6 13l6-6 6 6M12 7v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>${modalMarkup()}</div>`;
    bind();
    if (searchState) {
      const search = app.querySelector(".search");
      search.focus({ preventScroll: true });
      search.setSelectionRange(searchState.start, searchState.end, searchState.direction);
    }
    if (position && anchorIndex >= 0) {
      const showcase = app.querySelector(".showcase");
      const cell = app.querySelector(`.index-cell[data-number="${position.number}"]`);
      const headerHeight = columns.length === 4 ? 46 : 88;
      const rowRect = cell.getBoundingClientRect();
      showcase.scrollTop += rowRect.top - showcase.getBoundingClientRect().top - headerHeight + position.fraction * rowRect.height;
      showcase.scrollLeft = position.left;
    }
    let rendered = initialCount;
    const marker = app.querySelector(".load-more");
    const appendRows = () => {
      if (rendered >= scenes.length) { rowObserver?.disconnect(); marker.remove(); return; }
      const next = Math.min(rendered + ROW_BATCH, scenes.length);
      app.querySelector(".table-grid").insertAdjacentHTML("beforeend", scenes.slice(rendered, next).map(row).join(""));
      rendered = next;
      marker.textContent = `已显示 ${rendered} / ${scenes.length} 组`;
      if (rendered === scenes.length) { rowObserver?.disconnect(); marker.remove(); }
    };
    if (rendered < scenes.length) {
      marker.textContent = `已显示 ${rendered} / ${scenes.length} 组`;
      if ("IntersectionObserver" in window) {
        rowObserver = new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) appendRows();
        }, { root: app.querySelector(".showcase"), rootMargin: "700px" });
        rowObserver.observe(marker);
      } else {
        app.querySelector(".showcase").addEventListener("scroll", () => {
          if (marker.getBoundingClientRect().top < window.innerHeight + 700) appendRows();
        });
      }
    } else marker.remove();
  }

  function tableHead() {
    if (columns.length === 4) return `<div class="th th-index">序号</div>${columns.map(([key, label]) => `<div class="th th-${key}">${esc(label)}</div>`).join("")}`;
    return `<div class="th th-index compare-span">序号</div><div class="th compare-span">原图</div><div class="th compare-group group-realtime">低强度</div><div class="th compare-group group-beauty">高强度</div><div class="th compare-sub tone-default">自然调</div><div class="th compare-sub round-first">暖调</div><div class="th compare-sub round-second">冷调</div><div class="th compare-sub tone-default workflow-start">自然调</div><div class="th compare-sub round-first">暖调</div><div class="th compare-sub round-second">冷调</div>`;
  }

  function compareButton(scene, left, right, text) {
    return `<button type="button" data-compare="${scene.id}" data-left="${left}" data-right="${right}" data-left-label="${fullLabel(left)}" data-right-label="${fullLabel(right)}">${text}</button>`;
  }

  function row(scene) {
    return `<div class="td index-cell" data-number="${scene.number}"><span>${String(scene.number).padStart(3, "0")}</span></div>${columns.map(([key]) => {
      const label = fullLabel(key);
      let actions;
      if (key === "original") {
        actions = `<button type="button" class="detail-button" data-detail="${scene.id}" title="同步放大${columns.length}张图查看细节">细节对比</button>`;
      } else if (columns.length === 4) {
        actions = compareButton(scene, "original", key, "↔ 原图");
        if (key === "warm" || key === "cold") actions += compareButton(scene, "natural", key, "↔ 自然调");
        if (key === "cold") actions += compareButton(scene, "warm", key, "↔ 暖调");
      } else if (key.startsWith("low_")) {
        actions = compareButton(scene, "original", key, "原图对比");
      } else {
        const tone = key.slice("high_".length);
        actions = compareButton(scene, `low_${tone}`, key, "强度对比") + compareButton(scene, "original", key, "原图对比");
      }
      const preview = scene.previews?.[key] || scene.thumbs?.[key] || scene.images[key];
      return `<div class="td ${key === "low_default" ? "workflow-start" : ""}"><div class="thumb"><img src="${scene.thumbs?.[key] || preview}" alt="${esc(scene.categoryName + " " + label)}" width="${scene.width || 16}" height="${scene.height || 9}" loading="lazy" decoding="async" data-single="${scene.id}" data-key="${key}" data-full="${scene.images[key]}" title="点击查看大图"/><div class="thumb-actions">${actions}</div></div></div>`;
    }).join("")}`;
  }

  function modalMarkup() {
    return `<div class="modal" role="dialog" aria-modal="true"><div class="modal-panel"><div class="modal-head"><div class="modal-title"><strong></strong></div><div class="zoom-controls"><button type="button" data-group-prev title="上一组">↑</button><button type="button" data-group-next title="下一组">↓</button><a class="source-link" target="_blank" rel="noopener">原文件</a><button type="button" data-zoom-out title="缩小" aria-label="缩小">−</button><button type="button" data-one-to-one title="1:1 原尺寸">1:1</button><button type="button" data-zoom-in title="放大" aria-label="放大">+</button><button type="button" data-reset title="适应窗口">适应</button><span class="zoom-readout">100%</span></div><button type="button" class="modal-close" aria-label="关闭">×</button></div><div class="stage-wrap"><button type="button" class="single-nav single-prev" aria-label="上一张">‹</button><div class="stage"><img class="after" alt="右侧对比图"/><div class="before-wrap"><img class="before" alt="左侧对比图"/></div><div class="handle">↔</div><span class="badge left"></span><span class="badge right"></span></div><button type="button" class="single-nav single-next" aria-label="下一张">›</button></div></div></div>`;
  }

  function bind() {
    app.querySelectorAll("[data-dataset]").forEach((button) => button.addEventListener("click", () => {
      if (dataset === button.dataset.dataset) return;
      const position = capturePosition();
      dataset = button.dataset.dataset; singleState = compareState = null; interaction = null;
      render({ position });
    }));
    const search = app.querySelector(".search");
    const updateSearch = () => {
      query = search.value;
      render({ searchState: { start: search.selectionStart, end: search.selectionEnd, direction: search.selectionDirection } });
    };
    search.addEventListener("input", (event) => { if (!event.isComposing && !search._composing) updateSearch(); });
    search.addEventListener("compositionstart", () => { search._composing = true; });
    search.addEventListener("compositionend", () => { search._composing = false; updateSearch(); });
    app.querySelector(".back-to-top").addEventListener("click", () => app.querySelector(".showcase").scrollTo({ top: 0, behavior: "smooth" }));
    const grid = app.querySelector(".table-grid");
    grid.addEventListener("click", (event) => {
      const compare = event.target.closest("[data-compare]");
      if (compare) { event.stopPropagation(); openCompare(compare.dataset); return; }
      const detail = event.target.closest("[data-detail]");
      if (detail) {
        event.stopPropagation();
        document.dispatchEvent(new CustomEvent("review:details", { detail: { dataset, id: detail.dataset.detail } }));
        return;
      }
      const image = event.target.closest("[data-single]");
      if (image) openSingle(image.dataset.single, image.dataset.key);
    });
    grid.addEventListener("pointerover", (event) => {
      const image = event.target.closest("[data-single]");
      if (image && !image.contains(event.relatedTarget))
        image._prefetchTimer = window.setTimeout(() => preloadFull(image.dataset.full), 450);
    });
    grid.addEventListener("pointerout", (event) => {
      const image = event.target.closest("[data-single]");
      if (image && !image.contains(event.relatedTarget)) window.clearTimeout(image._prefetchTimer);
    });
    app.querySelector("[data-group-prev]").addEventListener("click", () => changeGroup(-1));
    app.querySelector("[data-group-next]").addEventListener("click", () => changeGroup(1));
    app.querySelector(".single-prev").addEventListener("click", () => changeSingle(-1));
    app.querySelector(".single-next").addEventListener("click", () => changeSingle(1));
    app.querySelector(".modal-close").addEventListener("click", closeModal);
    app.querySelector(".modal").addEventListener("click", (event) => { if (event.target.classList.contains("modal")) closeModal(); });
    app.querySelector("[data-zoom-out]").addEventListener("click", () => zoom(1 / 1.2));
    app.querySelector("[data-zoom-in]").addEventListener("click", () => zoom(1.2));
    app.querySelector("[data-one-to-one]").addEventListener("click", oneToOne);
    app.querySelector("[data-reset]").addEventListener("click", () => reset(app.querySelector(".stage")));
    const stage = app.querySelector(".stage");
    stage.addEventListener("wheel", (event) => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX, event.clientY); }, { passive: false });
    stage.addEventListener("pointerdown", startInteraction);

  }

  window.addEventListener("pointermove", moveInteraction);
  window.addEventListener("pointerup", endInteraction);
  window.addEventListener("pointercancel", endInteraction);
  const sceneById = (id) => datasetScenes().find((scene) => scene.id === id);
  function preloadFull(src) {
    if (!src) return Promise.resolve();
    if (fullImageCache.has(src)) return fullImageCache.get(src);
    const image = new Image(); image.decoding = "async"; image.fetchPriority = "high";
    const promise = new Promise((resolve, reject) => {
      image.onload = () => resolve(src); image.onerror = reject; image.src = src;
    });
    promise.image = image;
    fullImageCache.set(src, promise); promise.catch(() => fullImageCache.delete(src)); return promise;
  }
  function applyRatio(image, stage) {
    const update = () => { if (image.naturalHeight) stage.style.setProperty("--image-ratio", String(image.naturalWidth / image.naturalHeight)); };
    image.addEventListener("load", update, { once: true }); if (image.complete) update();
  }
  function setProgressiveImage(image, previewSrc, fullSrc, stage, sequence) {
    image.dataset.fullSrc = fullSrc; image.dataset.fullReady = "false"; image.fetchPriority = "high"; image.src = previewSrc || fullSrc; applyRatio(image, stage);
    const promise = preloadFull(fullSrc).then(() => {
      if (Number(stage.dataset.loadSequence) !== sequence) return;
      image.src = fullSrc; image.dataset.fullReady = "true";
    });
    image._fullPromise = promise; return promise;
  }
  function beginStageLoad(stage, items) {
    const sequence = ++loadSequence; stage.dataset.loadSequence = String(sequence); stage.classList.add("loading-full");
    Promise.allSettled(items.map(({ image, preview, full }) => setProgressiveImage(image, preview, full, stage, sequence))).then(() => {
      if (Number(stage.dataset.loadSequence) === sequence) stage.classList.remove("loading-full");
    });
  }
  function updateReadout(stage) { app.querySelector(".zoom-readout").textContent = `${Math.round(Number(stage.dataset.zoom || 1) * 100)}%`; }
  function reset(stage) {
    stage.dataset.zoom = "1"; stage.dataset.panX = "0"; stage.dataset.panY = "0";
    stage.style.setProperty("--zoom", "1"); stage.style.setProperty("--pan-x", "0px"); stage.style.setProperty("--pan-y", "0px");
    stage.classList.remove("zoomed", "dragging"); updateReadout(stage);
  }
  function clampPan(stage) {
    const value = Number(stage.dataset.zoom || 1), maxX = stage.clientWidth * Math.max(0, value - 1) / 2, maxY = stage.clientHeight * Math.max(0, value - 1) / 2;
    const x = Math.max(-maxX, Math.min(maxX, Number(stage.dataset.panX || 0))), y = Math.max(-maxY, Math.min(maxY, Number(stage.dataset.panY || 0)));
    stage.dataset.panX = String(x); stage.dataset.panY = String(y); stage.style.setProperty("--pan-x", `${x}px`); stage.style.setProperty("--pan-y", `${y}px`);
  }
  function zoom(factor, clientX, clientY) {
    const stage = app.querySelector(".stage"), oldZoom = Number(stage.dataset.zoom || 1), nextZoom = Math.min(12, Math.max(1, oldZoom * factor));
    if (clientX != null && clientY != null && nextZoom !== oldZoom) {
      const rect = stage.getBoundingClientRect(), offsetX = clientX - rect.left - rect.width / 2, offsetY = clientY - rect.top - rect.height / 2;
      stage.dataset.panX = String(Number(stage.dataset.panX || 0) - offsetX * (nextZoom / oldZoom - 1));
      stage.dataset.panY = String(Number(stage.dataset.panY || 0) - offsetY * (nextZoom / oldZoom - 1));
    }
    stage.dataset.zoom = String(nextZoom); stage.style.setProperty("--zoom", String(nextZoom));
    if (nextZoom === 1) { stage.dataset.panX = "0"; stage.dataset.panY = "0"; }
    stage.classList.toggle("zoomed", nextZoom > 1); clampPan(stage); updateReadout(stage);
  }
  async function ensureFullImage(image) {
    if (image.dataset.fullReady === "true") return;
    await preloadFull(image.dataset.fullSrc); image.src = image.dataset.fullSrc; image.dataset.fullReady = "true";
    if (image.decode) await image.decode().catch(() => {});
  }
  async function oneToOne() {
    const stage = app.querySelector(".stage"), image = stage.querySelector(".after"); await ensureFullImage(image); if (!image.naturalWidth) return;
    const fit = Math.min(stage.clientWidth / image.naturalWidth, stage.clientHeight / image.naturalHeight), value = Math.min(12, Math.max(1, 1 / fit));
    stage.dataset.zoom = String(value); stage.dataset.panX = "0"; stage.dataset.panY = "0"; stage.style.setProperty("--zoom", String(value));
    stage.classList.toggle("zoomed", value > 1); clampPan(stage); updateReadout(stage);
  }
  function startInteraction(event) {
    if (event.button !== 0) return;
    const stage = event.currentTarget, rect = stage.getBoundingClientRect(), split = Number(stage.style.getPropertyValue("--split").replace("%", "") || 50), splitX = rect.left + rect.width * split / 100;
    if (!singleState && Math.abs(event.clientX - splitX) < 28) { interaction = { mode: "split", stage, pointerId: event.pointerId }; updateSplit(event, stage); }
    else if (Number(stage.dataset.zoom || 1) > 1) {
      interaction = { mode: "image", stage, pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: Number(stage.dataset.panX || 0), panY: Number(stage.dataset.panY || 0) };
      stage.classList.add("dragging");
    }
    if (interaction) stage.setPointerCapture?.(event.pointerId);
  }
  function updateSplit(event, stage) {
    const rect = stage.getBoundingClientRect(), value = Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)); stage.style.setProperty("--split", `${value}%`);
  }
  function moveInteraction(event) {
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    if (interaction.mode === "split") return updateSplit(event, interaction.stage);
    interaction.stage.dataset.panX = String(interaction.panX + event.clientX - interaction.x);
    interaction.stage.dataset.panY = String(interaction.panY + event.clientY - interaction.y); clampPan(interaction.stage);
  }
  function endInteraction(event) { if (!interaction || interaction.pointerId !== event.pointerId) return; interaction.stage.classList.remove("dragging"); interaction = null; }

  function openCompare(data) {
    compareState = { ...data };
    app.querySelector(".source-link").href = sceneById(data.compare).images[data.right];
    const scene = sceneById(data.compare), modal = app.querySelector(".modal"), stage = modal.querySelector(".stage"); singleState = null; modal.classList.remove("single");
    modal.querySelector(".modal-title strong").textContent = `${String(scene.number).padStart(3, "0")} · ${data.leftLabel} / ${data.rightLabel}`;
    modal.querySelector(".badge.left").textContent = data.leftLabel; modal.querySelector(".badge.right").textContent = data.rightLabel; stage.style.setProperty("--split", "50%"); reset(stage); modal.classList.add("open");
    beginStageLoad(stage, [
      { image: modal.querySelector(".before"), preview: scene.previews?.[data.left] || scene.thumbs?.[data.left], full: scene.images[data.left] },
      { image: modal.querySelector(".after"), preview: scene.previews?.[data.right] || scene.thumbs?.[data.right], full: scene.images[data.right] },
    ]);
  }
  function openSingle(id, key) { compareState = null; singleState = { id, index: Math.max(0, columns.findIndex(([columnKey]) => columnKey === key)) }; showSingle(); }
  function showSingle() {
    const { id, index } = singleState, [key] = columns[index], scene = sceneById(id), modal = app.querySelector(".modal"), stage = modal.querySelector(".stage");
    app.querySelector(".source-link").href = scene.images[key];
    modal.classList.add("single", "open"); modal.querySelector(".modal-title strong").textContent = `${String(scene.number).padStart(3, "0")} · ${fullLabel(key)} · ${index + 1}/${columns.length}`; reset(stage);
    beginStageLoad(stage, [{ image: modal.querySelector(".after"), preview: scene.previews?.[key] || scene.thumbs?.[key], full: scene.images[key] }]);
  }
  function changeSingle(delta) { if (singleState) { singleState.index = (singleState.index + delta + columns.length) % columns.length; showSingle(); } }
  function changeGroup(delta) {
    const id = singleState?.id || compareState?.compare;
    if (!id) return;
    const scenes = datasetScenes();
    const index = scenes.findIndex(scene => scene.id === id);
    const next = scenes[(index + delta + scenes.length) % scenes.length];
    if (singleState) { singleState.id = next.id; showSingle(); }
    else openCompare({ ...compareState, compare: next.id });
  }
  function closeModal() { compareState = null; app.querySelector(".modal").classList.remove("open"); singleState = null; interaction = null; }

  window.addEventListener("keydown", (event) => {
    if (!app.querySelector(".modal.open")) return;
    if (event.key === "Escape") closeModal();
    if (singleState && event.key === "ArrowLeft") changeSingle(-1);
    if (singleState && event.key === "ArrowRight") changeSingle(1);
  });
  Promise.resolve(window.REVIEW_DATA).then((data) => { manifest = data; const requested = new URLSearchParams(location.search).get("dataset"); dataset = data.datasets[requested] ? requested : (data.meta?.defaultDataset || "1014"); render(); })
    .catch((error) => { app.innerHTML = `<div class="loading">页面加载失败：${esc(error.message)}</div>`; });
})();
