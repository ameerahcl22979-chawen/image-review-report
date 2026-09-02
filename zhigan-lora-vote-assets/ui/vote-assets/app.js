(() => {
  // 效果列定义（6个效果，不含原图）
  const effectColumns = [
    ["low_default", "低强度·原色调", "default"],
    ["low_warm", "低强度·暖调", "warm"],
    ["low_neutral", "低强度·中性调", "neutral"],
    ["high_default", "高强度·原色调", "default"],
    ["high_warm", "高强度·暖调", "warm"],
    ["high_neutral", "高强度·中性调", "neutral"],
  ];

  const categoryOrder = ["lighting", "material", "structure", "color"];
  const STORAGE_KEY = "vote_assessment_data_v1";

  const app = document.querySelector("#app");
  let manifest;
  let voteData = loadVoteData();
  let singleState = null;

  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

  // 加载投票数据
  function loadVoteData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn("加载投票数据失败:", e);
      return {};
    }
  }

  // 保存投票数据
  function saveVoteData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(voteData));
    } catch (e) {
      console.warn("保存投票数据失败:", e);
    }
  }

  // 获取某组某效果的投票状态
  function getVote(sceneId, effectKey) {
    return voteData[sceneId]?.[effectKey] || null;
  }

  // 设置投票
  function setVote(sceneId, effectKey, value) {
    if (!voteData[sceneId]) voteData[sceneId] = {};
    if (voteData[sceneId][effectKey] === value) {
      delete voteData[sceneId][effectKey]; // 再次点击取消
    } else {
      voteData[sceneId][effectKey] = value;
    }
    saveVoteData();
  }

  // 批量设置某组所有效果
  function batchVote(sceneId, value) {
    if (!voteData[sceneId]) voteData[sceneId] = {};
    effectColumns.forEach(([key]) => {
      voteData[sceneId][key] = value;
    });
    saveVoteData();
  }

  // 统计投票进度
  function getStats() {
    let total = 0, voted = 0, pass = 0, fail = 0;
    manifest.scenes.forEach((scene) => {
      effectColumns.forEach(([key]) => {
        total++;
        const v = getVote(scene.id, key);
        if (v === "pass") { voted++; pass++; }
        else if (v === "fail") { voted++; fail++; }
      });
    });
    return { total, voted, pass, fail, percent: total ? Math.round(voted / total * 100) : 0 };
  }

  // 按分类分组场景
  function groupByCategory() {
    const groups = {};
    manifest.scenes.forEach((scene) => {
      const cat = scene.categoryId || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(scene);
    });
    return groups;
  }

  function render() {
    const groups = groupByCategory();
    const stats = getStats();
    const categories = manifest.categories || [];

    app.innerHTML = `<div class="app vote-app">
      <header class="topbar">
        <div class="brand">
          <div>
            <h1>专项测试投票评估 · 增强幅度与色调</h1>
            <p>160组专项测试 × 6种效果 = ${stats.total}项评估 · 已完成 ${stats.voted}/${stats.total} (${stats.percent}%)</p>
          </div>
        </div>
        <div class="vote-actions">
          <div class="vote-stats">
            <span class="stat-pass">通过 ${stats.pass}</span>
            <span class="stat-fail">不通过 ${stats.fail}</span>
          </div>
          <button class="export-btn" id="exportBtn">导出JSON</button>
          <button class="clear-btn" id="clearBtn">清空投票</button>
        </div>
      </header>
      <div class="shell">
        <div class="vote-progress-bar">
          <div class="vote-progress-fill" style="width:${stats.percent}%"></div>
          <span class="vote-progress-text">${stats.voted}/${stats.total} (${stats.percent}%)</span>
        </div>
        ${categoryOrder.filter(cat => groups[cat]).map(catId => {
          const cat = categories.find(c => c.id === catId) || { id: catId, name: catId };
          const scenes = groups[catId] || [];
          const catStats = getCategoryStats(scenes);
          return `
          <section class="category-section">
            <h2 class="category-title">${esc(cat.name)} <span class="category-count">${scenes.length}组</span> <span class="category-progress">已评估 ${catStats.voted}/${catStats.total} (${catStats.percent}%)</span></h2>
            <div class="table-grid vote-grid">
              ${tableHead()}
              ${scenes.map(scene => row(scene)).join("")}
            </div>
          </section>`;
        }).join("")}
      </div>
      ${modalMarkup()}
    </div>`;
    bind();
  }

  function getCategoryStats(scenes) {
    let total = 0, voted = 0;
    scenes.forEach((scene) => {
      effectColumns.forEach(([key]) => {
        total++;
        if (getVote(scene.id, key)) voted++;
      });
    });
    return { total, voted, percent: total ? Math.round(voted / total * 100) : 0 };
  }

  function tableHead() {
    return `<div class="th th-index">序号</div>
      <div class="th">原图</div>
      <div class="th group-low">低强度</div>
      <div class="th group-high">高强度</div>
      ${effectColumns.map(([key, label, type]) => `<div class="th th-effect th-${type}">${label.replace("·", "<br>")}</div>`).join("")}
      <div class="th th-batch">批量操作</div>`;
  }

  function row(scene) {
    const allPass = effectColumns.every(([key]) => getVote(scene.id, key) === "pass");
    const allFail = effectColumns.every(([key]) => getVote(scene.id, key) === "fail");
    return `<div class="td index-cell"><span>${String(scene.number).padStart(2, "0")}</span></div>
      <div class="td td-original">
        <div class="thumb">
          <img src="${scene.images.original}" alt="原图" loading="lazy" decoding="async" data-single="${scene.id}" data-key="original" title="点击查看大图"/>
        </div>
      </div>
      ${effectColumns.map(([key, label, type]) => {
        const vote = getVote(scene.id, key);
        return `<div class="td td-effect td-${type} ${vote ? `voted-${vote}` : ""}">
          <div class="thumb">
            <img src="${scene.images[key]}" alt="${esc(label)}" loading="lazy" decoding="async" data-single="${scene.id}" data-key="${key}" title="点击查看大图"/>
          </div>
          <div class="vote-buttons">
            <button class="vote-btn vote-pass ${vote === "pass" ? "active" : ""}" data-scene="${scene.id}" data-effect="${key}" data-value="pass" title="通过">✓ 通过</button>
            <button class="vote-btn vote-fail ${vote === "fail" ? "active" : ""}" data-scene="${scene.id}" data-effect="${key}" data-value="fail" title="不通过">✗ 不通过</button>
          </div>
        </div>`;
      }).join("")}
      <div class="td td-batch">
        <button class="batch-btn batch-pass ${allPass ? "active" : ""}" data-scene="${scene.id}" data-value="pass">全部通过</button>
        <button class="batch-btn batch-fail ${allFail ? "active" : ""}" data-scene="${scene.id}" data-value="fail">全部不通过</button>
      </div>`;
  }

  function modalMarkup() {
    return `<div class="modal" role="dialog" aria-modal="true">
      <div class="modal-panel">
        <div class="modal-head">
          <div class="modal-title"><strong></strong></div>
          <button class="modal-close" aria-label="关闭">×</button>
        </div>
        <div class="stage-wrap">
          <button class="single-nav single-prev" aria-label="上一张">‹</button>
          <div class="stage">
            <img class="after" alt="查看大图"/>
          </div>
          <button class="single-nav single-next" aria-label="下一张">›</button>
        </div>
      </div>
    </div>`;
  }

  function bind() {
    // 投票按钮
    app.querySelectorAll(".vote-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setVote(btn.dataset.scene, btn.dataset.effect, btn.dataset.value);
        render();
      });
    });

    // 批量投票按钮
    app.querySelectorAll(".batch-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        batchVote(btn.dataset.scene, btn.dataset.value);
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

    // 图片点击查看大图
    app.querySelectorAll("[data-single]").forEach((img) => {
      img.addEventListener("click", () => openSingle(img.dataset.single, img.dataset.key));
    });

    // 模态框
    app.querySelector(".modal-close").addEventListener("click", closeModal);
    app.querySelector(".modal").addEventListener("click", (event) => { if (event.target.classList.contains("modal")) closeModal(); });
    app.querySelector(".single-prev").addEventListener("click", () => changeSingle(-1));
    app.querySelector(".single-next").addEventListener("click", () => changeSingle(1));
  }

  function sceneById(id) { return manifest.scenes.find((scene) => scene.id === id); }

  function allColumns() {
    return [["original", "原图"], ...effectColumns];
  }

  function openSingle(id, key) {
    const cols = allColumns();
    singleState = { id, index: Math.max(0, cols.findIndex(([k]) => k === key)) };
    showSingle();
  }

  function showSingle() {
    const cols = allColumns();
    const { id, index } = singleState;
    const [key, label] = cols[index];
    const scene = sceneById(id);
    const modal = app.querySelector(".modal");
    const stage = modal.querySelector(".stage");
    modal.querySelector(".modal-title strong").textContent = `${String(scene.number).padStart(2, "0")} · ${scene.categoryName} · ${label} · ${index + 1}/${cols.length}`;
    const after = modal.querySelector(".after");
    after.src = scene.images[key];
    after.onload = () => {
      if (after.naturalHeight) stage.style.setProperty("--image-ratio", String(after.naturalWidth / after.naturalHeight));
    };
    if (after.complete && after.naturalHeight) {
      stage.style.setProperty("--image-ratio", String(after.naturalWidth / after.naturalHeight));
    }
    modal.classList.add("open");
  }

  function changeSingle(delta) {
    if (!singleState) return;
    const cols = allColumns();
    singleState.index = (singleState.index + delta + cols.length) % cols.length;
    showSingle();
  }

  function closeModal() {
    app.querySelector(".modal").classList.remove("open");
    singleState = null;
  }

  // 导出JSON
  function exportJSON() {
    const stats = getStats();
    const exportData = {
      meta: {
        title: "专项测试投票评估结果",
        exportTime: new Date().toISOString(),
        totalScenes: manifest.scenes.length,
        totalEffects: effectColumns.length,
        totalAssessments: stats.total,
        completed: stats.voted,
        passCount: stats.pass,
        failCount: stats.fail,
        passRate: stats.voted ? (stats.pass / stats.voted * 100).toFixed(1) + "%" : "0%",
      },
      categories: {},
      scenes: {},
    };

    // 按分类统计
    const groups = groupByCategory();
    const categories = manifest.categories || [];
    categoryOrder.filter(cat => groups[cat]).forEach(catId => {
      const cat = categories.find(c => c.id === catId) || { id: catId, name: catId };
      const scenes = groups[catId] || [];
      let catTotal = 0, catVoted = 0, catPass = 0, catFail = 0;
      scenes.forEach(scene => {
        effectColumns.forEach(([key]) => {
          catTotal++;
          const v = getVote(scene.id, key);
          if (v === "pass") { catVoted++; catPass++; }
          else if (v === "fail") { catVoted++; catFail++; }
        });
      });
      exportData.categories[catId] = {
        name: cat.name,
        sceneCount: scenes.length,
        totalAssessments: catTotal,
        completed: catVoted,
        passCount: catPass,
        failCount: catFail,
        passRate: catVoted ? (catPass / catVoted * 100).toFixed(1) + "%" : "0%",
      };
    });

    // 每场场景的详细投票
    manifest.scenes.forEach(scene => {
      const sceneVotes = {};
      effectColumns.forEach(([key, label]) => {
        sceneVotes[key] = {
          label,
          vote: getVote(scene.id, key) || "unvoted",
        };
      });
      exportData.scenes[scene.id] = {
        number: scene.number,
        category: scene.categoryName,
        sourceName: scene.sourceName || "",
        votes: sceneVotes,
      };
    });

    // 下载文件
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

  // 键盘快捷键
  window.addEventListener("keydown", (event) => {
    if (!app.querySelector(".modal.open")) return;
    if (event.key === "Escape") closeModal();
    if (singleState && event.key === "ArrowLeft") { event.preventDefault(); changeSingle(-1); }
    if (singleState && event.key === "ArrowRight") { event.preventDefault(); changeSingle(1); }
  });

  // 加载manifest
  fetch(window.REVIEW_MANIFEST, { cache: "no-store" })
    .then((response) => response.json())
    .then((data) => { manifest = data; render(); })
    .catch((error) => { app.innerHTML = `<div class="loading">页面加载失败：${esc(error.message)}</div>`; });
})();
