(() => {
  const columns = [
    ["original", "原图"],
    ["low_default", "低强度·自然调"],
    ["low_warm", "低强度·暖调"],
    ["low_neutral", "低强度·冷调"],
    ["high_default", "高强度·自然调"],
    ["high_warm", "高强度·暖调"],
    ["high_neutral", "高强度·冷调"],
  ];
  const categoryOrder = ["lighting", "material", "structure", "color"];
  const app = document.querySelector("#app");
  let manifest;
  let dataset = "0923";
  let category = "all";
  let query = "";
  let singleState = null;

  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const datasetScenes = () => manifest.datasets?.[dataset]?.scenes || [];
  const visibleScenes = () => datasetScenes().filter((scene) =>
    (category === "all" || scene.categoryId === category) &&
    (!query || `${scene.number} ${scene.categoryName} ${scene.sourceName}`.toLowerCase().includes(query.toLowerCase()))
  );

  function render() {
    const scenes = visibleScenes();
    const total = datasetScenes().length;
    const emptyMessage = "没有匹配的测试图片";
    app.innerHTML = `<div class="app">
      <header class="topbar"><div class="brand"><div><h1>4K 离线 · 六种增强效果对比</h1></div></div><div class="summary"><strong>${scenes.length}</strong>/ ${total} 组</div></header>
      <div class="shell"><div class="filterbar"><div class="filter-group version-switch" role="tablist" aria-label="效果版本"><button class="filter-chip module-chip ${dataset === "0923" ? "active" : ""}" data-dataset="0923" role="tab" aria-selected="${dataset === "0923"}">0923版本</button><button class="filter-chip module-chip ${dataset === "0915" ? "active" : ""}" data-dataset="0915" role="tab" aria-selected="${dataset === "0915"}">0915版本</button></div><input class="search" value="${esc(query)}" placeholder="搜索序号" aria-label="搜索"/></div>
      <section class="showcase"><div class="table-grid">${tableHead()}${scenes.length ? scenes.map((scene) => row(scene)).join("") : `<div class="empty">${emptyMessage}</div>`}</div></section></div>
      ${modalMarkup()}</div>`;
    bind();
  }

  function tableHead() {
    return `<div class="th th-index compare-span">序号</div><div class="th compare-span">原图</div><div class="th compare-group group-realtime">低强度</div><div class="th compare-group group-beauty">高强度</div><div class="th compare-sub tone-default">自然调</div><div class="th compare-sub round-first">暖调</div><div class="th compare-sub round-second">冷调</div><div class="th compare-sub tone-default workflow-start">自然调</div><div class="th compare-sub round-first">暖调</div><div class="th compare-sub round-second">冷调</div>`;
  }

  function fullLabel(key) {
    return ({ original: "原图", low_default: "低强度 · 自然调", low_warm: "低强度 · 暖调", low_neutral: "低强度 · 冷调", high_default: "高强度 · 自然调", high_warm: "高强度 · 暖调", high_neutral: "高强度 · 冷调" })[key];
  }

  function row(scene) {
    return `<div class="td index-cell"><span>${String(scene.number).padStart(2, "0")}</span></div>${columns.map(([key]) => {
      const label = fullLabel(key);
      const original = key === "original";
      const strengthCompare = key === "high_default" ? `<button data-compare="${scene.id}" data-left="low_default" data-right="high_default" data-left-label="低强度 · 自然调" data-right-label="高强度 · 自然调">强度对比</button>` : "";
      const defaultCompare = key === "low_warm" ? `<button data-compare="${scene.id}" data-left="low_default" data-right="low_warm" data-left-label="低强度 · 自然调" data-right-label="低强度 · 暖调">↔ 自然调对比</button>` : key === "low_neutral" ? `<button data-compare="${scene.id}" data-left="low_default" data-right="low_neutral" data-left-label="低强度 · 自然调" data-right-label="低强度 · 冷调">↔ 自然调对比</button>` : key === "high_warm" ? `<button data-compare="${scene.id}" data-left="high_default" data-right="high_warm" data-left-label="高强度 · 自然调" data-right-label="高强度 · 暖调">↔ 自然调对比</button>` : key === "high_neutral" ? `<button data-compare="${scene.id}" data-left="high_default" data-right="high_neutral" data-left-label="高强度 · 自然调" data-right-label="高强度 · 冷调">↔ 自然调对比</button>` : "";
      const buttons = original ? "" : `<div class="thumb-actions"><button data-compare="${scene.id}" data-left="original" data-right="${key}" data-left-label="原图" data-right-label="${label}">↔ 原图对比</button>${defaultCompare}${strengthCompare}</div>`;
      return `<div class="td ${key === "low_default" ? "workflow-start" : ""}"><div class="thumb"><img src="${scene.thumbs?.[key] || scene.images[key]}" alt="${esc(scene.categoryName + " " + label)}" loading="lazy" decoding="async" data-single="${scene.id}" data-key="${key}" title="点击查看大图"/>${buttons}</div></div>`;
    }).join("")}`;
  }

  function modalMarkup() {
    return `<div class="modal" role="dialog" aria-modal="true"><div class="modal-panel"><div class="modal-head"><div class="modal-title"><strong></strong></div><button class="modal-close" aria-label="关闭">×</button></div><div class="stage-wrap"><button class="single-nav single-prev" aria-label="上一张">‹</button><div class="stage"><img class="after" alt="右侧对比图"/><div class="before-wrap"><img class="before" alt="左侧对比图"/></div><div class="handle">↔</div><input type="range" min="0" max="100" value="50" aria-label="两张图片分割位置"/><span class="badge left"></span><span class="badge right"></span></div><button class="single-nav single-next" aria-label="下一张">›</button></div></div></div>`;
  }

  function bind() {
    app.querySelectorAll("[data-dataset]").forEach((button) => button.addEventListener("click", () => { dataset = button.dataset.dataset; category = "all"; query = ""; render(); }));
    app.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => { category = button.dataset.category; render(); }));
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

  function sceneById(id) { return datasetScenes().find((scene) => scene.id === id); }
  function applyRatio(image, stage) { const update = () => { if (image.naturalHeight) stage.style.setProperty("--image-ratio", String(image.naturalWidth / image.naturalHeight)); }; image.onload = update; if (image.complete) update(); }
  function openCompare({ id, left, right, leftLabel, rightLabel }) {
    const scene = sceneById(id); const modal = app.querySelector(".modal"); const stage = modal.querySelector(".stage"); singleState = null;
    modal.classList.remove("single"); modal.querySelector(".modal-title strong").textContent = `${String(scene.number).padStart(2, "0")} · ${leftLabel} / ${rightLabel}`;
    const before = modal.querySelector(".before"); const after = modal.querySelector(".after"); before.src = scene.images[left]; after.src = scene.images[right]; applyRatio(after, stage);
    modal.querySelector(".badge.left").textContent = leftLabel; modal.querySelector(".badge.right").textContent = rightLabel; stage.style.setProperty("--split", "50%"); modal.querySelector("input").value = 50; modal.classList.add("open");
  }
  function openSingle(id, key) { singleState = { id, index: Math.max(0, columns.findIndex(([columnKey]) => columnKey === key)) }; showSingle(); }
  function showSingle() {
    const { id, index } = singleState; const [key] = columns[index]; const scene = sceneById(id); const modal = app.querySelector(".modal"); const stage = modal.querySelector(".stage");
    modal.classList.add("single"); modal.querySelector(".modal-title strong").textContent = `${String(scene.number).padStart(2, "0")} · ${fullLabel(key)} · ${index + 1}/7`;
    const after = modal.querySelector(".after"); after.src = scene.images[key]; applyRatio(after, stage); modal.classList.add("open");
  }
  function changeSingle(delta) { if (!singleState) return; singleState.index = (singleState.index + delta + columns.length) % columns.length; showSingle(); }
  function closeModal() { app.querySelector(".modal").classList.remove("open"); singleState = null; }
  window.addEventListener("keydown", (event) => { if (!app.querySelector(".modal.open")) return; if (event.key === "Escape") closeModal(); if (singleState && event.key === "ArrowLeft") { event.preventDefault(); changeSingle(-1); } if (singleState && event.key === "ArrowRight") { event.preventDefault(); changeSingle(1); } });

  Promise.resolve(window.REVIEW_DATA).then((data) => { manifest = data; render(); })
    .catch((error) => { app.innerHTML = `<div class="loading">页面加载失败：${esc(error.message)}</div>`; });
})();
