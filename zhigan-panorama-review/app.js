(() => {
  const columns = [
    ["original", "原始图"],
    ["workflow_a", "原效果"],
    ["workflow_b", "测试效果"]
  ];
  const app = document.querySelector("#app");
  let manifest = window.REVIEW_MANIFEST_DATA;
  let query = "";
  let singleState = null;

  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const visibleScenes = () => manifest.scenes.filter((scene) => !query || `${scene.number} ${scene.categoryName} ${scene.sourceName}`.toLowerCase().includes(query.toLowerCase()));

  function render() {
    const scenes = visibleScenes();
    app.innerHTML = `<div class="app">
      <header class="topbar"><div class="brand"><div><h1>全景图质感增强效果对比</h1></div></div><div class="topbar-tools"><input class="search" value="${esc(query)}" placeholder="搜索序号或文件名" aria-label="搜索"/><div class="summary"><strong>${scenes.length}</strong>/ ${manifest.scenes.length} 组</div></div></header>
      <div class="shell">
      <section class="showcase"><div class="table-grid panorama-grid">${tableHead()}${scenes.length ? scenes.map((scene) => row(scene)).join("") : '<div class="empty">没有匹配的测试图片</div>'}</div></section></div>
      ${modalMarkup()}</div>`;
    bind();
  }

  function tableHead() {
    return `<div class="th th-index">序号</div><div class="th">原始图</div><div class="th workflow-pill workflow-a workflow-start">原效果</div><div class="th workflow-pill workflow-b">测试效果</div>`;
  }

  function fullLabel(key) {
    return ({ original: "原始图", workflow_a: "原效果", workflow_b: "测试效果" })[key];
  }

  function panoramaViewerHref(scene, key) {
    const params = new URLSearchParams({
      src: scene.images[key],
      title: `${String(scene.number).padStart(2, "0")} · ${fullLabel(key)}`,
      yaw: "180",
      pitch: "0",
      fov: "100",
      v: "20260828-5",
    });
    return `./panorama-viewer.html?${params.toString()}`;
  }

  function previewAction(scene, key) {
    return `<a class="preview-link" href="${esc(panoramaViewerHref(scene, key))}" target="_blank" rel="noopener" title="打开全景预览"><span class="preview-icon" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.4"/><path d="M2.8 8h10.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M8 2.7c1.6 1.3 2.5 3.2 2.5 5.3S9.6 12 8 13.3C6.4 12 5.5 10.1 5.5 8s.9-4 2.5-5.3Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg></span><span>全景预览</span></a>`;
  }

  function thumbActions(scene, key) {
    const actions = [previewAction(scene, key)];
    if (key !== "original") {
      const rightLabel = fullLabel(key);
      const currentIndex = columns.findIndex(([columnKey]) => columnKey === key);
      const prevKey = currentIndex > 1 ? columns[currentIndex - 1][0] : null;
      actions.push(`<button type="button" data-compare="${scene.id}" data-left="original" data-right="${key}" data-left-label="原始图" data-right-label="${rightLabel}">原图对比</button>`);
      if (prevKey) {
        actions.push(`<button type="button" data-compare="${scene.id}" data-left="${prevKey}" data-right="${key}" data-left-label="${fullLabel(prevKey)}" data-right-label="${rightLabel}">原效果对比</button>`);
      }
    }
    return `<div class="thumb-actions">${actions.join("")}</div>`;
  }

  function row(scene) {
    const eager = scene.number <= 6;
    return `<div class="td index-cell"><span>${String(scene.number).padStart(2, "0")}</span></div>${columns.map(([key], index) => `<div class="td ${index === 1 ? "workflow-start" : ""}"><div class="thumb"><img src="${scene.thumbs?.[key] || scene.images[key]}" alt="${esc(scene.categoryName + " " + fullLabel(key))}" decoding="async" ${eager ? 'fetchpriority="high" loading="eager"' : 'fetchpriority="auto"'} data-single="${scene.id}" data-key="${key}" title="点击查看大图"/>${thumbActions(scene, key)}</div></div>`).join("")}`;
  }

  function modalMarkup() {
    return `<div class="modal" role="dialog" aria-modal="true"><div class="modal-panel"><div class="modal-head"><div class="modal-title"><strong></strong></div><button class="modal-close" aria-label="关闭" type="button">×</button></div><div class="stage-wrap"><button class="single-nav single-prev" aria-label="上一张" type="button">‹</button><div class="stage"><img class="after" alt="右侧对比图"/><div class="before-wrap"><img class="before" alt="左侧对比图"/></div><div class="handle">↔</div><input type="range" min="0" max="100" value="50" aria-label="两张图片分割位置"/><span class="badge left"></span><span class="badge right"></span></div><button class="single-nav single-next" aria-label="下一张" type="button">›</button></div></div></div>`;
  }

  function bind() {
    const search = app.querySelector(".search");
    search.addEventListener("input", () => { query = search.value; render(); app.querySelector(".search").focus(); });
    app.querySelectorAll("[data-compare]").forEach((button) => button.addEventListener("click", () => openCompare({ id: button.dataset.compare, left: button.dataset.left, right: button.dataset.right, leftLabel: button.dataset.leftLabel, rightLabel: button.dataset.rightLabel })));
    app.querySelectorAll("[data-single]").forEach((image) => image.addEventListener("click", () => openSingle(image.dataset.single, image.dataset.key)));
    app.querySelector(".single-prev").addEventListener("click", () => changeSingle(-1));
    app.querySelector(".single-next").addEventListener("click", () => changeSingle(1));
    app.querySelector(".modal-close").addEventListener("click", closeModal);
    app.querySelector(".modal").addEventListener("click", (event) => { if (event.target.classList.contains("modal")) closeModal(); });
    const range = app.querySelector(".stage input");
    range.addEventListener("input", () => app.querySelector(".stage").style.setProperty("--split", `${range.value}%`));
  }

  function sceneById(id) { return manifest.scenes.find((scene) => scene.id === id); }
  function applyRatio(image, stage) { const update = () => { if (image.naturalHeight) stage.style.setProperty("--image-ratio", String(image.naturalWidth / image.naturalHeight)); }; image.onload = update; if (image.complete) update(); }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      if (!src) { reject(new Error("missing src")); return; }
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }
  function upgradeImage(imageEl, src, stage) {
    if (!src || imageEl.src.endsWith(src)) return;
    imageEl.dataset.loading = "true";
    loadImage(src).then((image) => {
      imageEl.src = src;
      applyRatio(imageEl, stage);
      imageEl.dataset.loading = "false";
    }).catch(() => {
      imageEl.dataset.loading = "false";
    });
  }
  function openCompare({ id, left, right, leftLabel, rightLabel }) {
    const scene = sceneById(id); const modal = app.querySelector(".modal"); const stage = modal.querySelector(".stage"); singleState = null;
    modal.classList.remove("single"); modal.querySelector(".modal-title strong").textContent = `${String(scene.number).padStart(2, "0")} · ${leftLabel} / ${rightLabel}`;
    const before = modal.querySelector(".before"); const after = modal.querySelector(".after");
    before.src = scene.thumbs?.[left] || scene.images[left];
    after.src = scene.thumbs?.[right] || scene.images[right];
    applyRatio(after, stage);
    modal.querySelector(".badge.left").textContent = leftLabel; modal.querySelector(".badge.right").textContent = rightLabel; stage.style.setProperty("--split", "50%"); modal.querySelector("input").value = 50; modal.classList.add("open");
    upgradeImage(before, scene.images[left], stage);
    upgradeImage(after, scene.images[right], stage);
  }
  function openSingle(id, key) { singleState = { id, index: Math.max(0, columns.findIndex(([columnKey]) => columnKey === key)) }; showSingle(); }
  function showSingle() {
    const { id, index } = singleState; const [key] = columns[index]; const scene = sceneById(id); const modal = app.querySelector(".modal"); const stage = modal.querySelector(".stage");
    modal.classList.add("single"); modal.querySelector(".modal-title strong").textContent = `${String(scene.number).padStart(2, "0")} · ${fullLabel(key)} · ${index + 1} / ${columns.length}`;
    const after = modal.querySelector(".after"); after.src = scene.thumbs?.[key] || scene.images[key]; applyRatio(after, stage); modal.classList.add("open");
    upgradeImage(after, scene.images[key], stage);
  }
  function changeSingle(delta) { if (!singleState) return; singleState.index = (singleState.index + delta + columns.length) % columns.length; showSingle(); }
  function closeModal() { app.querySelector(".modal").classList.remove("open"); singleState = null; }
  window.addEventListener("keydown", (event) => { if (!app.querySelector(".modal.open")) return; if (event.key === "Escape") closeModal(); if (singleState && event.key === "ArrowLeft") { event.preventDefault(); changeSingle(-1); } if (singleState && event.key === "ArrowRight") { event.preventDefault(); changeSingle(1); } });

  render();
})();
