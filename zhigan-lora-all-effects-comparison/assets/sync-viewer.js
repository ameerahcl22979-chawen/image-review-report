(() => {
  const columns = [
    ["original", "原图"], ["low_default", "低强度·自然调"], ["low_warm", "低强度·暖调"],
    ["low_neutral", "低强度·冷调"], ["high_default", "高强度·自然调"], ["high_warm", "高强度·暖调"],
    ["high_neutral", "高强度·冷调"],
  ];
  const fullCache = new Map();
  let dialog;
  let dataset = "0923";
  let sceneIndex = 0;
  let zoom = 1;
  let centerX = 0.5;
  let centerY = 0.5;
  let drag = null;
  let opener = null;
  let loadToken = 0;

  function scenes() {
    return window.REVIEW_DATA?.datasets?.[dataset]?.scenes || [];
  }

  function init() {
    dialog = document.createElement("div");
    dialog.className = "sync-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "细节对比");
    dialog.innerHTML = `<div class="sync-panel"><div class="sync-header"><strong class="sync-title"></strong><div class="sync-controls"><button type="button" data-action="prev" title="上一组" aria-label="上一组">‹</button><button type="button" data-action="next" title="下一组" aria-label="下一组">›</button><button type="button" data-action="out" title="缩小" aria-label="缩小">−</button><button type="button" data-action="actual" title="原尺寸，七图保持同一视野">1:1</button><button type="button" data-action="in" title="放大" aria-label="放大">+</button><button type="button" data-action="fit" title="适应窗口">适应</button><span class="sync-readout">100%</span></div><button type="button" class="sync-close" data-action="close" title="关闭" aria-label="关闭">×</button></div><div class="sync-grid">${columns.map(([key, label]) => `<figure class="sync-column"><figcaption>${label}</figcaption><div class="sync-viewport" data-key="${key}" tabindex="0"><img alt="${label}" draggable="false"></div></figure>`).join("")}</div></div>`;
    document.body.append(dialog);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) return close();
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "close") close();
      if (action === "prev") changeScene(-1);
      if (action === "next") changeScene(1);
      if (action === "in") setZoom(zoom * 1.25);
      if (action === "out") setZoom(zoom / 1.25);
      if (action === "fit") reset();
      if (action === "actual") actualSize();
    });
    dialog.querySelectorAll(".sync-viewport").forEach((view) => {
      view.addEventListener("wheel", (event) => {
        event.preventDefault();
        setZoom(zoom * (event.deltaY < 0 ? 1.2 : 1 / 1.2), view, event.clientX, event.clientY);
      }, { passive: false });
      view.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || zoom <= 1) return;
        drag = { pointerId: event.pointerId, view, x: event.clientX, y: event.clientY, centerX, centerY };
        view.setPointerCapture(event.pointerId);
        view.classList.add("dragging");
      });
      view.addEventListener("pointermove", (event) => {
        if (!drag || drag.pointerId !== event.pointerId || drag.view !== view) return;
        const fit = fittedSize(view);
        centerX = drag.centerX - (event.clientX - drag.x) / (fit.width * zoom);
        centerY = drag.centerY - (event.clientY - drag.y) / (fit.height * zoom);
        renderTransform();
      });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => view.addEventListener(type, (event) => {
        if (drag?.pointerId !== event.pointerId) return;
        drag = null;
        view.classList.remove("dragging");
        if (type !== "lostpointercapture" && view.hasPointerCapture(event.pointerId)) view.releasePointerCapture(event.pointerId);
      }));
      view.querySelector("img").addEventListener("load", renderTransform);
    });
    window.addEventListener("resize", () => { if (dialog.classList.contains("open")) renderTransform(); });
  }

  function fittedSize(view) {
    const image = view.querySelector("img");
    const width = image.naturalWidth || 16;
    const height = image.naturalHeight || 9;
    const scale = Math.min(view.clientWidth / width, view.clientHeight / height);
    return { width: width * scale, height: height * scale };
  }

  function renderTransform() {
    if (!dialog?.classList.contains("open")) return;
    const views = [...dialog.querySelectorAll(".sync-viewport")];
    const limits = views.map((view) => {
      const fit = fittedSize(view);
      return {
        x: Math.max(0, (fit.width * zoom - view.clientWidth) / (2 * fit.width * zoom)),
        y: Math.max(0, (fit.height * zoom - view.clientHeight) / (2 * fit.height * zoom)),
      };
    });
    const maxX = Math.min(...limits.map((limit) => limit.x));
    const maxY = Math.min(...limits.map((limit) => limit.y));
    centerX = Math.max(0.5 - maxX, Math.min(0.5 + maxX, centerX));
    centerY = Math.max(0.5 - maxY, Math.min(0.5 + maxY, centerY));
    views.forEach((view) => {
      const fit = fittedSize(view);
      const image = view.querySelector("img");
      image.style.width = `${fit.width}px`;
      image.style.height = `${fit.height}px`;
      image.style.transform = `translate(${(0.5 - centerX) * fit.width * zoom}px, ${(0.5 - centerY) * fit.height * zoom}px) scale(${zoom})`;
    });
    dialog.querySelector(".sync-readout").textContent = `${Math.round(zoom * 100)}%`;
  }

  function setZoom(next, view, clientX, clientY) {
    const updated = Math.max(1, Math.min(16, next));
    if (view && updated !== zoom) {
      const fit = fittedSize(view);
      const rect = view.getBoundingClientRect();
      const offsetX = clientX - rect.left - rect.width / 2;
      const offsetY = clientY - rect.top - rect.height / 2;
      centerX += offsetX / (fit.width * zoom) - offsetX / (fit.width * updated);
      centerY += offsetY / (fit.height * zoom) - offsetY / (fit.height * updated);
    }
    zoom = updated;
    if (zoom === 1) centerX = centerY = 0.5;
    renderTransform();
    if (zoom >= 2.25) ensureFullImages();
  }

  function reset() {
    zoom = 1;
    centerX = centerY = 0.5;
    renderTransform();
  }

  function preload(src) {
    if (fullCache.has(src)) return fullCache.get(src);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = "high";
      image.onload = () => resolve(src);
      image.onerror = reject;
      image.src = src;
    });
    fullCache.set(src, promise);
    promise.catch(() => fullCache.delete(src));
    return promise;
  }

  async function ensureFullImages() {
    const token = loadToken;
    const current = scenes()[sceneIndex];
    if (!current) return;
    const pending = columns.map(([key]) => async () => {
      const view = dialog.querySelector(`[data-key="${key}"]`);
      const image = view.querySelector("img");
      if (image.dataset.fullReady === "true") return;
      view.classList.add("loading-full");
      await preload(current.images[key]);
      if (token !== loadToken) return;
      image.src = current.images[key];
      image.dataset.fullReady = "true";
      if (image.decode) await image.decode().catch(() => {});
      view.classList.remove("loading-full");
    });
    let next = 0;
    async function worker() {
      while (next < pending.length && token === loadToken) {
        const task = pending[next++];
        await task().catch(() => {});
      }
    }
    await Promise.all([worker(), worker()]);
    if (token === loadToken) renderTransform();
  }

  async function actualSize() {
    await ensureFullImages();
    const view = dialog.querySelector('[data-key="original"]');
    const image = view.querySelector("img");
    if (image.naturalWidth) setZoom(image.naturalWidth / fittedSize(view).width);
  }

  function showScene() {
    const current = scenes()[sceneIndex];
    if (!current) return;
    loadToken += 1;
    dialog.querySelector(".sync-title").textContent = `第 ${String(current.number).padStart(2, "0")} 组 · 七图细节对比 · ${dataset}版本`;
    columns.forEach(([key]) => {
      const view = dialog.querySelector(`[data-key="${key}"]`);
      const image = view.querySelector("img");
      view.classList.remove("loading-full");
      image.dataset.fullReady = "false";
      image.src = current.previews?.[key] || current.thumbs?.[key] || current.images[key];
    });
    dialog.querySelector('[data-action="prev"]').disabled = sceneIndex <= 0;
    dialog.querySelector('[data-action="next"]').disabled = sceneIndex >= scenes().length - 1;
    reset();
  }

  function changeScene(delta) {
    sceneIndex = Math.max(0, Math.min(scenes().length - 1, sceneIndex + delta));
    showScene();
  }

  function close() {
    loadToken += 1;
    dialog.classList.remove("open");
    document.body.classList.remove("sync-open");
    drag = null;
    opener?.focus();
  }

  document.addEventListener("review:details", (event) => {
    if (!dialog) init();
    dataset = event.detail.dataset;
    sceneIndex = Math.max(0, scenes().findIndex((scene) => scene.id === event.detail.id));
    opener = document.querySelector(`[data-detail="${event.detail.id}"]`);
    dialog.classList.add("open");
    document.body.classList.add("sync-open");
    showScene();
    dialog.querySelector(".sync-close").focus();
  });

  document.addEventListener("keydown", (event) => {
    if (!dialog?.classList.contains("open")) return;
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft") changeScene(-1);
    if (event.key === "ArrowRight") changeScene(1);
  });
})();
