(() => {
  const columns = [
    ["original", "原图"],
    ["low_default", "低强度·原色调"],
    ["low_warm", "低强度·暖调"],
    ["low_neutral", "低强度·中性调"],
    ["high_default", "高强度·原色调"],
    ["high_warm", "高强度·暖调"],
    ["high_neutral", "高强度·中性调"],
  ];
  const effectKeys = ["low_default", "low_warm", "low_neutral", "high_default", "high_warm", "high_neutral"];
  const categoryOrder = ["lighting", "material", "structure", "color"];
  const STORAGE_KEY = "vote_assessment_data_v2";
  const app = document.querySelector("#app");
  let manifest;
  let dataset = "badcase";
  let category = "all";
  let query = "";
  let singleState = null;
  let voteData = loadVoteData();

  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const datasetScenes = () => manifest.scenes.filter((scene) => dataset === "full" ? scene.categoryId === "full" : scene.categoryId !== "full");
  const visibleScenes = () => datasetScenes().filter((scene) =>
    (dataset === "full" || category === "all" || scene.categoryId === category) &&
    (!query || `${scene.number} ${scene.categoryName} ${scene.sourceName}`.toLowerCase().includes(query.toLowerCase()))
  );

  function loadVoteData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveVoteData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(voteData)); } catch (e) {}
  }
  function getVote(sceneId, effectKey) {
    return voteData[sceneId]?.[effectKey] || null;
  }
  function setVote(sceneId, effectKey, value) {
    if (!voteData[sceneId]) voteData[sceneId] = {};
    if (voteData[sceneId][effectKey] === value) {
      delete voteData[sceneId][effectKey];
    } else {
      voteData[sceneId][effectKey] = value;
    }
    saveVoteData();
  }
  function batchVote(sceneId, value) {
    if (!voteData[sceneId]) voteData[sceneId] = {};
    effectKeys.forEach((key) => { voteData[sceneId][key] = value; });
    saveVoteData();
  }
  function getStats() {
    let total = 0, voted = 0, pass = 0, fail = 0;
    manifest.scenes.forEach((scene) => {
      if (scene.categoryId === "full") return;
      effectKeys.forEach((key) => {
        total++;
        const v = getVote(scene.id, key);
        if (v === "pass") { voted++; pass++; }
        else if (v === "fail") { voted++; fail++; }
      });
    });
    return { total, voted, pass, fail, percent: total ? Math.round(voted / total * 100) : 0 };
  }

  function render() {
    const scenes = visibleScenes();
    const total = datasetScenes().length;
    const stats = getStats();
    const categories = manifest.categories.filter((item) => item.id !== "full").sort((a, b) => categoryOrder.indexOf(a.id) - categoryOrder.indexOf(b.id));
    const categoryButtons = dataset === "badcase" ? `<span class="filter-divider"></span>${categories.map((item) => `<button class="filter-chip category-chip ${category === item.id ? "active" : ""}" data-category="${item.id}">${esc(item.name)}</button>`).join("")}` : "";
    app.innerHTML = `<div class="app vote-app">
      <header class="topbar"><div class="brand"><div><h1>专项测试投票评估 · 增强幅度与色调</h1><p>160组专项测试 × 6种效果 = ${stats.total}项评估 · 已完成 ${stats.voted}/${stats.total} (${stats.percent}%)</p></div></div>
      <div class="vote-top-actions">
        <span class="vote-stat vote-stat-pass">通过 ${stats.pass}</span>
        <span class="vote-stat vote-stat-fail">不通过 ${stats.fail}</span>
        <button class="vote-export-btn" id="exportBtn">导出JSON</button>
        <button class="vote-clear-btn" id="clearBtn">清空</button>
      </div></header>
      <div class="shell">
        <div class="vote-progress-bar"><div class="vote-progress-fill" style="width:${stats.percent}%"></div><span class="vote-progress-text">${stats.voted}/${stats.total} (${stats.percent}%)</span></div>
        <div class="filterbar"><div class="filter-group"><span class="filter-label">测试模块</span><button class="filter-chip module-chip ${dataset === "full" ? "active" : ""}" data-dataset="full">完整测试集</button><button class="filter-chip module-chip ${dataset === "badcase" ? "active" : ""}" data-dataset="badcase">Badcase 专项测试</button>${categoryButtons}</div><input class="search" value="${esc(query)}" placeholder="搜索序号或专项" aria-label="搜索"/></div>
      <section class="showcase"><div class="table-grid vote-table-grid">${tableHead()}${scenes.length ? scenes.map((scene) => row(scene)).join("") : '<div class="empty">没有匹配的测试图片</div>'}</div></section></div>
      ${modalMarkup()}</div>`;
    bind();
  }

  function tableHead() {
    return `<div class="th th-index compare-span">序号</div><div class="th compare-span">原图</div><div class="th compare-group group-realtime">低强度</div><div class="th compare-group group-beauty">高强度</div><div class="th compare-sub tone-default">原色调</div><div class="th compare-sub round-first">暖调</div><div class="th compare-sub round-second">中性调</div><div class="th compare-sub tone-default workflow-start">原色调</div><div class="th compare-sub round-first">暖调</div><div class="th compare-sub round-second">中性调</div><div class="th th-batch-col">批量操作</div>`;
  }

  function fullLabel(key) {
    return ({ original: "原图", low_default: "低强度 · 原色调", low_warm: "低强度 · 暖调", low_neutral: "低强度 · 中性调", high_default: "高强度 · 原色调", high_warm: "高强度 · 暖调", high_neutral: "高强度 · 中性调" })[key];
  }

  function row(scene) {
    const allPass = effectKeys.every((key) => getVote(scene.id, key) === "pass");
    const allFail = effectKeys.every((key) => getVote(scene.id, key) === "fail");
    return `<div class="td index-cell"><span>${String(scene.number).padStart(2, "0")}</span></div>${columns.map(([key]) => {
      const label = fullLabel(key);
      const original = key === "original";
      const strengthCompare = key === "high_default" ? `<button data-compare="${scene.id}" data-left="low_default" data-right="high_default" data-left-label="低强度 · 原色调" data-right-label="高强度 · 原色调">强度对比</button>` : "";
      const defaultCompare = key === "low_warm" ? `<button data-compare="${scene.id}" data-left="low_default" data-right="low_warm" data-left-label="低强度 · 原色调" data-right-label="低强度 · 暖调">↔ 原色调对比</button>` : key === "low_neutral" ? `<button data-compare="${scene.id}" data-left="low_default" data-right="low_neutral" data-left-label="低强度 · 原色调" data-right-label="低强度 · 中性调">↔ 原色调对比</button>` : key === "high_warm" ? `<button data-compare="${scene.id}" data-left="high_default" data-right="high_warm" data-left-label="高强度 · 原色调" data-right-label="高强度 · 暖调">↔ 原色调对比</button>` : key === "high_neutral" ? `<button data-compare="${scene.id}" data-left="high_default" data-right="high_neutral" data-left-label="高强度 · 原色调" data-right-label="高强度 · 中性调">↔ 原色调对比</button>` : "";
      const buttons = original ? "" : `<div class="thumb-actions"><button data-compare="${scene.id}" data-left="original" data-right="${key}" data-left-label="原图" data-right-label="${label}">↔ 原图对比</button>${defaultCompare}${strengthCompare}</div>`;
      const vote = original ? "" : getVote(scene.id, key);
      const voteBtns = original ? "" : `<div class="vote-row-buttons">
        <button class="vote-row-btn vote-row-pass ${vote === "pass" ? "active" : ""}" data-vote-scene="${scene.id}" data-vote-effect="${key}" data-vote-value="pass">✓ 通过</button>
        <button class="vote-row-btn vote-row-fail ${vote === "fail" ? "active" : ""}" data-vote-scene="${scene.id}" data-vote-effect="${key}" data-vote-value="fail">✗ 不通过</button>
      </div>`;
      return `<div class="td ${key === "low_default" ? "workflow-start" : ""} ${vote ? `voted-${vote}` : ""}"><div class="thumb"><img src="${scene.thumbs?.[key] || scene.images[key]}" alt="${esc(scene.categoryName + " " + label)}" loading="lazy" decoding="async" data-single="${scene.id}" data-key="${key}" title="点击查看大图"/>${buttons}</div>${voteBtns}</div>`;
    }).join("")}
    <div class="td td-batch-col">
      <button class="batch-col-btn batch-col-pass ${allPass ? "active" : ""}" data-batch-scene="${scene.id}" data-batch-value="pass">全部通过</button>
      <button class="batch-col-btn batch-col-fail ${allFail ? "active" : ""}" data-batch-scene="${scene.id}" data-batch-value="fail">全部不通过</button>
    </div>`;
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
    // 投票按钮
    app.querySelectorAll("[data-vote-scene]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setVote(btn.dataset.voteScene, btn.dataset.voteEffect, btn.dataset.voteValue);
        render();
      });
    });
    // 批量投票按钮
    app.querySelectorAll("[data-batch-scene]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        batchVote(btn.dataset.batchScene, btn.dataset.batchValue);
        render();
      });
    });
    // 导出按钮
    const exportBtn = app.querySelector("#exportBtn");
    if (exportBtn) exportBtn.addEventListener("click", exportJSON);
    // 清空按钮
    const clearBtn = app.querySelector("#clearBtn");
    if (clearBtn) clearBtn.addEventListener("click", () => {
      if (confirm("确定要清空所有投票数据吗？此操作不可恢复。")) {
        voteData = {};
        saveVoteData();
        render();
      }
    });
  }

  function sceneById(id) { return manifest.scenes.find((scene) => scene.id === id); }
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

  function exportJSON() {
    const stats = getStats();
    const groups = {};
    const categories = manifest.categories || [];
    categoryOrder.forEach((catId) => {
      const cat = categories.find((c) => c.id === catId);
      if (!cat) return;
      const scenes = manifest.scenes.filter((s) => s.categoryId === catId);
      let catTotal = 0, catVoted = 0, catPass = 0, catFail = 0;
      scenes.forEach((scene) => {
        effectKeys.forEach((key) => {
          catTotal++;
          const v = getVote(scene.id, key);
          if (v === "pass") { catVoted++; catPass++; }
          else if (v === "fail") { catVoted++; catFail++; }
        });
      });
      groups[catId] = {
        name: cat.name, sceneCount: scenes.length, totalAssessments: catTotal,
        completed: catVoted, passCount: catPass, failCount: catFail,
        passRate: catVoted ? (catPass / catVoted * 100).toFixed(1) + "%" : "0%",
      };
    });
    const scenesData = {};
    manifest.scenes.forEach((scene) => {
      if (scene.categoryId === "full") return;
      const votes = {};
      effectKeys.forEach((key) => {
        votes[key] = { label: fullLabel(key), vote: getVote(scene.id, key) || "unvoted" };
      });
      scenesData[scene.id] = { number: scene.number, category: scene.categoryName, sourceName: scene.sourceName || "", votes };
    });
    const exportData = {
      meta: {
        title: "专项测试投票评估结果",
        exportTime: new Date().toISOString(),
        totalScenes: Object.keys(scenesData).length,
        totalEffects: effectKeys.length,
        totalAssessments: stats.total,
        completed: stats.voted, passCount: stats.pass, failCount: stats.fail,
        passRate: stats.voted ? (stats.pass / stats.voted * 100).toFixed(1) + "%" : "0%",
      },
      categories: groups,
      scenes: scenesData,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vote_assessment_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  window.addEventListener("keydown", (event) => { if (!app.querySelector(".modal.open")) return; if (event.key === "Escape") closeModal(); if (singleState && event.key === "ArrowLeft") { event.preventDefault(); changeSingle(-1); } if (singleState && event.key === "ArrowRight") { event.preventDefault(); changeSingle(1); } });

  fetch(window.REVIEW_MANIFEST, { cache: "no-store" }).then((response) => response.json()).then((data) => { manifest = data; render(); })
    .catch((error) => { app.innerHTML = `<div class="loading">页面加载失败：${esc(error.message)}</div>`; });
})();
