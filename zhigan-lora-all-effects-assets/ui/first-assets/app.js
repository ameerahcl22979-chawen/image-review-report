(() => {
  const round = window.REVIEW_ROUND || "首轮";
  const columns = [
    ["original", "原始渲染图"],
    ["realtime_online", "实时增强 · 线上"],
    ["realtime_lora", `实时增强 · ${round} LoRA`],
    ["beauty_online", "AI美化 · 线上"],
    ["beauty_lora", `AI美化 · ${round} LoRA`],
  ];
  const categoryOrder = ["color", "material", "lighting", "structure"];
  const app = document.querySelector("#app");
  let manifests;
  let dataset = "full";
  let category = "all";
  let query = "";
  let singleState = null;

  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const activeManifest = () => manifests[dataset];
  const visibleScenes = () => activeManifest().scenes.filter((scene) =>
    (dataset === "full" || category === "all" || scene.categoryId === category) &&
    (!query || `${scene.number} ${scene.categoryName} ${scene.sourceName}`.toLowerCase().includes(query.toLowerCase()))
  );

  function render() {
    const manifest = activeManifest();
    const scenes = visibleScenes();
    const categories = manifests.badcase.categories.slice().sort((a, b) => categoryOrder.indexOf(a.id) - categoryOrder.indexOf(b.id));
    const categoryButtons = dataset === "badcase" ? `<span class="filter-divider"></span>${categories.map((item) => `<button class="filter-chip category-chip ${category === item.id ? "active" : ""}" data-category="${item.id}">${esc(item.name)}</button>`).join("")}` : "";
    app.innerHTML = `<div class="app">
      <header class="topbar"><div class="brand"><div><h1>${round} LoRA 效果测试对比</h1><p>本次测试从整体效果与 Badcase 专项测试两大模块进行展开</p></div></div><div class="summary"><strong>${scenes.length}</strong>/ ${manifest.meta.sceneCount} 组</div></header>
      <div class="shell"><div class="filterbar"><div class="filter-group"><span class="filter-label">测试模块</span><button class="filter-chip module-chip ${dataset === "full" ? "active" : ""}" data-dataset="full">完整效果测试</button><button class="filter-chip module-chip ${dataset === "badcase" ? "active" : ""}" data-dataset="badcase">Badcase 专项测试</button>${categoryButtons}</div><input class="search" value="${esc(query)}" placeholder="搜索序号或专项" aria-label="搜索"/></div>
      <section class="showcase"><div class="table-grid"><div class="th th-index">序号</div>${columns.map(([key, label]) => `<div class="th ${key.endsWith("_lora") ? "th-lora" : ""}">${esc(label)}</div>`).join("")}${scenes.length ? scenes.map((scene) => row(scene)).join("") : '<div class="empty">没有匹配的测试图片</div>'}</div></section></div>
      ${modalMarkup()}</div>`;
    bind();
  }

  function row(scene) {
    return `<div class="td index-cell"><span>${String(scene.number).padStart(2, "0")}</span></div>${columns.map(([key, label]) => {
      const original = key === "original";
      const compareButtons = original ? "" : `<div class="thumb-actions"><button data-compare="${scene.id}" data-left="original" data-right="${key}" data-left-label="原始渲染图" data-right-label="${esc(label)}">↔ 原图对比</button>${key === "beauty_lora" ? `<button data-compare="${scene.id}" data-left="realtime_lora" data-right="beauty_lora" data-left-label="实时增强 · ${round} LoRA" data-right-label="AI美化 · ${round} LoRA">A/B 对比</button>` : ""}</div>`;
      return `<div class="td"><div class="thumb"><img src="${scene.thumbs?.[key] || scene.images[key]}" alt="${esc(scene.categoryName + " " + label)}" loading="lazy" decoding="async" data-single="${scene.id}" data-key="${key}" title="点击查看大图"/>${compareButtons}</div></div>`;
    }).join("")}`;
  }

  function modalMarkup() {
    return `<div class="modal" role="dialog" aria-modal="true"><div class="modal-panel"><div class="modal-head"><div class="modal-title"><strong></strong></div><button class="modal-close" aria-label="关闭">×</button></div><div class="stage-wrap"><button class="single-nav single-prev" aria-label="上一张">‹</button><div class="stage"><img class="after" alt="右侧对比图"/><div class="before-wrap"><img class="before" alt="左侧对比图"/></div><div class="handle">↔</div><input type="range" min="0" max="100" value="50" aria-label="两张图片分割位置"/><span class="badge left"></span><span class="badge right"></span></div><button class="single-nav single-next" aria-label="下一张">›</button></div></div></div>`;
  }

  function bind() {
    app.querySelectorAll("[data-dataset]").forEach((button) => button.addEventListener("click", () => {
      dataset = button.dataset.dataset; category = "all"; query = ""; render();
    }));
    app.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => { category = button.dataset.category; render(); }));
    const search = app.querySelector(".search");
    search.addEventListener("input", () => { query = search.value; render(); app.querySelector(".search").focus(); });
    app.querySelectorAll("[data-compare]").forEach((button) => button.addEventListener("click", () => openCompare({
      id: button.dataset.compare, left: button.dataset.left, right: button.dataset.right,
      leftLabel: button.dataset.leftLabel, rightLabel: button.dataset.rightLabel,
    })));
    app.querySelectorAll("[data-single]").forEach((image) => image.addEventListener("click", () => openSingle(image.dataset.single, image.dataset.key)));
    app.querySelector(".single-prev").addEventListener("click", () => changeSingle(-1));
    app.querySelector(".single-next").addEventListener("click", () => changeSingle(1));
    app.querySelector(".modal-close").addEventListener("click", closeModal);
    app.querySelector(".modal").addEventListener("click", (event) => { if (event.target.classList.contains("modal")) closeModal(); });
    const range = app.querySelector(".stage input");
    range.addEventListener("input", () => app.querySelector(".stage").style.setProperty("--split", `${range.value}%`));
  }

  function sceneById(id) { return activeManifest().scenes.find((scene) => scene.id === id); }
  function applyRatio(image, stage) {
    const update = () => { if (image.naturalHeight) stage.style.setProperty("--image-ratio", String(image.naturalWidth / image.naturalHeight)); };
    image.onload = update; if (image.complete) update();
  }
  function openCompare({ id, left, right, leftLabel, rightLabel }) {
    const scene = sceneById(id); const modal = app.querySelector(".modal"); const stage = modal.querySelector(".stage");
    singleState = null;
    modal.classList.remove("single"); modal.querySelector(".modal-title strong").textContent = `${String(scene.number).padStart(2, "0")} · ${leftLabel} / ${rightLabel}`;
    const before = modal.querySelector(".before"); const after = modal.querySelector(".after");
    before.src = scene.images[left]; after.src = scene.images[right]; applyRatio(after, stage);
    modal.querySelector(".badge.left").textContent = leftLabel; modal.querySelector(".badge.right").textContent = rightLabel;
    stage.style.setProperty("--split", "50%"); modal.querySelector("input").value = 50; modal.classList.add("open");
  }
  function openSingle(id, key) {
    singleState = { id, index: Math.max(0, columns.findIndex(([columnKey]) => columnKey === key)) };
    showSingle();
  }
  function showSingle() {
    const { id, index } = singleState; const [key, label] = columns[index];
    const scene = sceneById(id); const modal = app.querySelector(".modal"); const stage = modal.querySelector(".stage");
    modal.classList.add("single"); modal.querySelector(".modal-title strong").textContent = `${String(scene.number).padStart(2, "0")} · ${label} · ${index + 1}/5`;
    const after = modal.querySelector(".after"); after.src = scene.images[key]; applyRatio(after, stage); modal.classList.add("open");
  }
  function changeSingle(delta) {
    if (!singleState) return;
    singleState.index = (singleState.index + delta + columns.length) % columns.length;
    showSingle();
  }
  function closeModal() { app.querySelector(".modal").classList.remove("open"); singleState = null; }
  window.addEventListener("keydown", (event) => {
    if (!app.querySelector(".modal.open")) return;
    if (event.key === "Escape") closeModal();
    if (singleState && event.key === "ArrowLeft") { event.preventDefault(); changeSingle(-1); }
    if (singleState && event.key === "ArrowRight") { event.preventDefault(); changeSingle(1); }
  });

  Promise.all([
    fetch("./full/manifest.json?v=20260815-1", { cache: "no-store" }).then((response) => response.json()),
    fetch(window.REVIEW_MANIFEST, { cache: "no-store" }).then((response) => response.json()),
  ]).then(([full, badcase]) => { manifests = { full, badcase }; render(); })
    .catch((error) => { app.innerHTML = `<div class="loading">页面加载失败：${esc(error.message)}</div>`; });
})();
