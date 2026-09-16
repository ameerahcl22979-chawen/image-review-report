(() => {
  const columns = [
    ["original", "原图（实时4K）"],
    ["reference2k", "2K效果"],
    ["effect1", "4K效果1"],
    ["effect2", "4K效果2"],
  ];
  const scenes = Array.from({ length: 100 }, (_, index) => index + 1).map((number) => {
    const file = `${String(number).padStart(3, "0")}.jpg`;
    return {
      id: `scene-${String(number).padStart(3, "0")}`,
      number,
      images: {
        original: `./assets/original/${file}?v=20260916-original-assets`,
        effect1: `./assets/effect1/${file}?v=20260916-original-assets`,
        effect2: `./assets/effect2/${file}?v=20260916-original-assets`,
        reference2k: `./assets/reference2k/${file}?v=20260916-original-assets`,
      },
      thumbs: {
        original: `./assets/thumbs/original/${file}?v=20260916-original-assets`,
        effect1: `./assets/thumbs/effect1/${file}?v=20260916-original-assets`,
        effect2: `./assets/thumbs/effect2/${file}?v=20260916-original-assets`,
        reference2k: `./assets/thumbs/reference2k/${file}?v=20260916-original-assets`,
      },
    };
  });

  const app = document.querySelector("#app");
  let query = "";
  let singleState = null;
  let compareState = null;
  let interaction = null;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);

  function render() {
    const rows = scenes.filter((scene) => !query || String(scene.number).padStart(3, "0").includes(query));
    app.innerHTML = `<div class="app">
      <header class="topbar">
        <div class="brand"><h1>4K实时增强 · 批量效果测试</h1></div>
        <div class="summary"><strong>${rows.length}</strong> / ${scenes.length} 组</div>
      </header>
      <main class="shell">
        <div class="filterbar">
          <div class="filter-group"><span class="filter-label">测试结果</span></div>
          <input class="search" value="${escapeHtml(query)}" placeholder="搜索序号，如 095" aria-label="搜索序号" />
        </div>
        <section class="showcase">
          <div class="table-grid">
            <div class="th th-index">序号</div>
            ${columns.map(([key, label]) => `<div class="th th-${key}">${escapeHtml(label)}</div>`).join("")}
            ${rows.map(rowMarkup).join("")}
          </div>
        </section>
      </main>
      ${modalMarkup()}
    </div>`;
    bind();
  }

  function rowMarkup(scene) {
    const padded = String(scene.number).padStart(3, "0");
    return `<div class="td index-cell"><span>${padded}</span></div>${columns.map(([key, label]) => {
      let actions = "";
      if (key !== "original") {
        const compareButton = (left, leftLabel, text) => `<button data-compare="${scene.id}" data-left="${left}" data-right="${key}" data-left-label="${leftLabel}" data-right-label="${label}">↔ ${text}</button>`;
        actions = `<div class="thumb-actions">${compareButton("original", "原图（实时4K）", "原图")}${key === "effect2" ? compareButton("effect1", "4K效果1", "4K效果1") : ""}${key !== "reference2k" ? compareButton("reference2k", "2K效果", "2K") : ""}</div>`;
      }
      return `<div class="td"><div class="thumb"><img src="${scene.thumbs[key]}" alt="${escapeHtml(label)} ${padded}" loading="lazy" decoding="async" data-single="${scene.id}" data-key="${key}" title="点击查看大图" />${actions}</div></div>`;
    }).join("")}`;
  }

  function modalMarkup() {
    return `<div class="modal" role="dialog" aria-modal="true">
      <div class="modal-panel">
        <div class="modal-head"><strong class="modal-title"></strong><div class="view-tools"><button class="prev-group" title="上一组" aria-label="上一组">↑</button><button class="next-group" title="下一组" aria-label="下一组">↓</button><button class="actual-size" title="原始像素比例">1:1</button><button class="fit-size" title="适应窗口">适应</button><a class="source-link" target="_blank" rel="noopener">原文件</a></div><button class="modal-close" aria-label="关闭">×</button></div>
        <div class="stage-wrap"><button class="single-nav single-prev">‹</button><div class="stage"><img class="after" /><div class="before-wrap"><img class="before" /></div><div class="handle">↔</div><input type="range" min="0" max="100" value="50" /><span class="badge left"></span><span class="badge right"></span></div><button class="single-nav single-next">›</button></div>
      </div>
    </div>`;
  }

  function bind() {
    const search = app.querySelector(".search");
    search.addEventListener("input", () => {
      query = search.value.trim();
      render();
      app.querySelector(".search").focus();
    });
    app.querySelectorAll("[data-compare]").forEach((button) => button.addEventListener("click", () => openCompare(button.dataset)));
    app.querySelectorAll("[data-single]").forEach((image) => image.addEventListener("click", () => openSingle(image.dataset.single, image.dataset.key)));
    app.querySelector(".single-prev").addEventListener("click", () => changeSingle(-1));
    app.querySelector(".single-next").addEventListener("click", () => changeSingle(1));
    app.querySelector(".modal-close").addEventListener("click", closeModal);
    app.querySelector(".prev-group").addEventListener("click", () => changeGroup(-1));
    app.querySelector(".next-group").addEventListener("click", () => changeGroup(1));
    app.querySelector(".fit-size").addEventListener("click", () => reset(app.querySelector(".stage")));
    app.querySelector(".actual-size").addEventListener("click", () => {
      const stage = app.querySelector(".stage");
      const image = stage.querySelector(".after");
      stage.dataset.zoom = Math.max(1, image.naturalWidth / stage.clientWidth);
      stage.style.setProperty("--zoom", stage.dataset.zoom);
      clampPan(stage);
    });
    app.querySelector(".modal").addEventListener("click", (event) => {
      if (event.target.classList.contains("modal")) closeModal();
    });
    const stage = app.querySelector(".stage");
    stage.addEventListener("wheel", (event) => {
      event.preventDefault();
      zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
    stage.addEventListener("pointerdown", startInteraction);
  }

  function findScene(id) { return scenes.find((scene) => scene.id === id); }
  function setRatio(image, stage) {
    const update = () => {
      if (image.naturalHeight) stage.style.setProperty("--image-ratio", image.naturalWidth / image.naturalHeight);
    };
    image.onload = update;
    if (image.complete) update();
  }
  function reset(stage) {
    stage.dataset.zoom = "1";
    stage.dataset.panX = "0";
    stage.dataset.panY = "0";
    stage.style.setProperty("--zoom", 1);
    stage.style.setProperty("--pan-x", "0px");
    stage.style.setProperty("--pan-y", "0px");
  }
  function openCompare(data) {
    compareState = { ...data };
    const scene = findScene(data.compare);
    const modal = app.querySelector(".modal");
    const stage = modal.querySelector(".stage");
    singleState = null;
    modal.classList.remove("single");
    modal.querySelector(".modal-title").textContent = `${String(scene.number).padStart(3, "0")} · ${data.leftLabel} / ${data.rightLabel}`;
    modal.querySelector(".before").src = scene.images[data.left];
    modal.querySelector(".after").src = scene.images[data.right];
    modal.querySelector(".source-link").href = scene.images[data.right];
    setRatio(modal.querySelector(".after"), stage);
    modal.querySelector(".badge.left").textContent = data.leftLabel;
    modal.querySelector(".badge.right").textContent = data.rightLabel;
    stage.style.setProperty("--split", "50%");
    modal.querySelector("input").value = 50;
    reset(stage);
    modal.classList.add("open");
  }
  function openSingle(id, key) {
    compareState = null;
    singleState = { id, index: Math.max(0, columns.findIndex(([columnKey]) => columnKey === key)) };
    showSingle();
  }
  function showSingle() {
    const { id, index } = singleState;
    const [key, label] = columns[index];
    const scene = findScene(id);
    const modal = app.querySelector(".modal");
    const stage = modal.querySelector(".stage");
    modal.classList.add("single");
    modal.querySelector(".modal-title").textContent = `${String(scene.number).padStart(3, "0")} · ${label} · ${index + 1}/${columns.length}`;
    const image = modal.querySelector(".after");
    image.src = scene.images[key];
    modal.querySelector(".source-link").href = scene.images[key];
    setRatio(image, stage);
    reset(stage);
    modal.classList.add("open");
  }
  function clampPan(stage) {
    const level = Number(stage.dataset.zoom || 1);
    const maxX = stage.clientWidth * Math.max(0, level - 1) / 2;
    const maxY = stage.clientHeight * Math.max(0, level - 1) / 2;
    const x = Math.max(-maxX, Math.min(maxX, Number(stage.dataset.panX || 0)));
    const y = Math.max(-maxY, Math.min(maxY, Number(stage.dataset.panY || 0)));
    stage.dataset.panX = x;
    stage.dataset.panY = y;
    stage.style.setProperty("--pan-x", `${x}px`);
    stage.style.setProperty("--pan-y", `${y}px`);
  }
  function zoom(factor) {
    const stage = app.querySelector(".stage");
    const level = Math.min(5, Math.max(1, Number(stage.dataset.zoom || 1) * factor));
    stage.dataset.zoom = level;
    stage.style.setProperty("--zoom", level);
    clampPan(stage);
  }
  function startInteraction(event) {
    const stage = event.currentTarget;
    const rect = stage.getBoundingClientRect();
    const split = rect.left + rect.width * Number(stage.style.getPropertyValue("--split").replace("%", "") || 50) / 100;
    if (!singleState && Math.abs(event.clientX - split) < 28) {
      interaction = { mode: "split", stage };
      updateSplit(event, stage);
      return;
    }
    if (Number(stage.dataset.zoom || 1) <= 1) return;
    interaction = { mode: "image", stage, x: event.clientX, y: event.clientY, panX: Number(stage.dataset.panX || 0), panY: Number(stage.dataset.panY || 0) };
  }
  function updateSplit(event, stage) {
    const rect = stage.getBoundingClientRect();
    const value = Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100));
    stage.style.setProperty("--split", `${value}%`);
    const input = stage.querySelector("input");
    if (input) input.value = value;
  }
  function moveInteraction(event) {
    if (!interaction) return;
    if (interaction.mode === "split") {
      updateSplit(event, interaction.stage);
      return;
    }
    const level = Number(interaction.stage.dataset.zoom || 1);
    const maxX = interaction.stage.clientWidth * (level - 1) / 2;
    const maxY = interaction.stage.clientHeight * (level - 1) / 2;
    const x = Math.max(-maxX, Math.min(maxX, interaction.panX + event.clientX - interaction.x));
    const y = Math.max(-maxY, Math.min(maxY, interaction.panY + event.clientY - interaction.y));
    interaction.stage.dataset.panX = x;
    interaction.stage.dataset.panY = y;
    interaction.stage.style.setProperty("--pan-x", `${x}px`);
    interaction.stage.style.setProperty("--pan-y", `${y}px`);
  }
  function endInteraction() { interaction = null; }
  function changeSingle(delta) {
    if (!singleState) return;
    singleState.index = (singleState.index + delta + columns.length) % columns.length;
    showSingle();
  }
  function closeModal() {
    endInteraction();
    app.querySelector(".modal").classList.remove("open");
    singleState = null;
    compareState = null;
  }

  function changeGroup(delta) {
    const id = singleState ? singleState.id : compareState?.compare;
    if (!id) return;
    const index = scenes.findIndex(scene => scene.id === id);
    const next = scenes[(index + delta + scenes.length) % scenes.length];
    if (singleState) {
      singleState.id = next.id;
      showSingle();
    } else {
      openCompare({ ...compareState, compare: next.id });
    }
  }

  window.addEventListener("pointermove", moveInteraction);
  window.addEventListener("pointerup", endInteraction);
  window.addEventListener("pointercancel", endInteraction);
  addEventListener("keydown", (event) => {
    if (!app.querySelector(".modal.open")) return;
    if (event.key === "Escape") closeModal();
    if (singleState && event.key === "ArrowLeft") changeSingle(-1);
    if (singleState && event.key === "ArrowRight") changeSingle(1);
  });
  render();
})();
