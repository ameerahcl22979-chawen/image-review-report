(() => {
  const labels = ["原图", "2K工作流效果", "4K工作流效果（0915）", "4K工作流效果（0923）"];
  const keys = ["original", "low2k", "effect4k", "effect4k0923"];
  let dialog, group = 1, zoom = 1, centerX = .5, centerY = .5, drag = null, opener = null;
  const sources = new Map();

  function init() {
    dialog = document.createElement("div");
    dialog.className = "sync-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "细节对比");
    dialog.innerHTML = `<div class="sync-panel"><div class="sync-header"><strong class="sync-title"></strong><div class="sync-controls"><button type="button" data-action="prev" title="上一组" aria-label="上一组">‹</button><button type="button" data-action="next" title="下一组" aria-label="下一组">›</button><button type="button" data-action="out" title="缩小" aria-label="缩小">−</button><button type="button" data-action="actual" title="0923结果原尺寸，四图保持同一视野">1:1</button><button type="button" data-action="in" title="放大" aria-label="放大">+</button><button type="button" data-action="fit" title="适应窗口">适应</button><span class="sync-readout">100%</span></div><button type="button" class="sync-close" data-action="close" title="关闭" aria-label="关闭">×</button></div><div class="sync-grid">${keys.map((key, i) => `<figure class="sync-column"><figcaption>${labels[i]}</figcaption><div class="sync-viewport" data-key="${key}"><img alt="${labels[i]}" draggable="false"></div></figure>`).join("")}</div></div>`;
    document.body.append(dialog);
    dialog.addEventListener("click", event => {
      if (event.target === dialog) { close(); return; }
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "close") close();
      if (action === "prev") changeGroup(-1);
      if (action === "next") changeGroup(1);
      if (action === "in") setZoom(zoom * 1.25);
      if (action === "out") setZoom(zoom / 1.25);
      if (action === "fit") reset();
      if (action === "actual") actualSize();
    });
    dialog.querySelectorAll(".sync-viewport").forEach(view => {
      view.addEventListener("wheel", event => {
        event.preventDefault();
        setZoom(zoom * (event.deltaY < 0 ? 1.2 : 1 / 1.2), view, event.clientX, event.clientY);
      }, { passive: false });
      view.addEventListener("pointerdown", event => {
        if (event.button !== 0 || zoom <= 1) return;
        drag = { pointerId: event.pointerId, view, x: event.clientX, y: event.clientY, centerX, centerY };
        view.setPointerCapture(event.pointerId);
        view.classList.add("dragging");
      });
      view.addEventListener("pointermove", event => {
        if (!drag || drag.pointerId !== event.pointerId || drag.view !== view) return;
        const fit = fittedSize(view);
        centerX = drag.centerX - (event.clientX - drag.x) / (fit.width * zoom);
        centerY = drag.centerY - (event.clientY - drag.y) / (fit.height * zoom);
        renderTransform();
      });
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
        view.addEventListener(type, event => {
          if (drag?.pointerId !== event.pointerId) return;
          drag = null;
          view.classList.remove("dragging");
          if (type !== "lostpointercapture" && view.hasPointerCapture(event.pointerId)) view.releasePointerCapture(event.pointerId);
        });
      }
      view.querySelector("img").addEventListener("load", renderTransform);
    });
    window.addEventListener("resize", () => { if (dialog.classList.contains("open")) renderTransform(); });
  }

  function fittedSize(view) {
    const img = view.querySelector("img");
    const width = img.naturalWidth || 16, height = img.naturalHeight || 9;
    const scale = Math.min(view.clientWidth / width, view.clientHeight / height);
    return { width: width * scale, height: height * scale };
  }

  function renderTransform() {
    if (!dialog?.classList.contains("open")) return;
    const views = [...dialog.querySelectorAll(".sync-viewport")];
    // One normalized image center keeps differing 2K/4K dimensions aligned.
    const limits = views.map(view => {
      const fit = fittedSize(view);
      return {
        x: Math.max(0, (fit.width * zoom - view.clientWidth) / (2 * fit.width * zoom)),
        y: Math.max(0, (fit.height * zoom - view.clientHeight) / (2 * fit.height * zoom))
      };
    });
    const maxX = Math.min(...limits.map(limit => limit.x));
    const maxY = Math.min(...limits.map(limit => limit.y));
    centerX = Math.max(.5 - maxX, Math.min(.5 + maxX, centerX));
    centerY = Math.max(.5 - maxY, Math.min(.5 + maxY, centerY));
    views.forEach(view => {
      const fit = fittedSize(view);
      const img = view.querySelector("img");
      img.style.width = `${fit.width}px`;
      img.style.height = `${fit.height}px`;
      img.style.transform = `translate(${(.5 - centerX) * fit.width * zoom}px, ${(.5 - centerY) * fit.height * zoom}px) scale(${zoom})`;
    });
    dialog.querySelector(".sync-readout").textContent = `${Math.round(zoom * 100)}%`;
  }

  function setZoom(next, view, clientX, clientY) {
    const updated = Math.max(1, Math.min(16, next));
    if (view && updated !== zoom) {
      const fit = fittedSize(view), rect = view.getBoundingClientRect();
      const offsetX = clientX - rect.left - rect.width / 2;
      const offsetY = clientY - rect.top - rect.height / 2;
      centerX += offsetX / (fit.width * zoom) - offsetX / (fit.width * updated);
      centerY += offsetY / (fit.height * zoom) - offsetY / (fit.height * updated);
    }
    zoom = updated;
    if (zoom === 1) centerX = centerY = .5;
    renderTransform();
  }

  function reset() { zoom = 1; centerX = centerY = .5; renderTransform(); }
  function actualSize() {
    const view = dialog.querySelector('[data-key="effect4k0923"]');
    const img = view.querySelector("img");
    if (img.naturalWidth) setZoom(img.naturalWidth / fittedSize(view).width);
  }
  function sourceFor(number) {
    if (sources.has(number)) return sources.get(number);
    const reference = sources.get(group) || sources.values().next().value;
    if (!reference) return null;
    const replaceNumber = path => path.replace(/\d{3}(?=\.jpg(?:\?|$))/, String(number).padStart(3, "0"));
    const result = Object.fromEntries(keys.map(key => [key, replaceNumber(reference[key])]));
    sources.set(number, result);
    return result;
  }
  function totalGroups() {
    const match = document.querySelector(".summary")?.textContent.match(/\/\s*(\d+)/);
    return Number(match?.[1]) || Math.max(group, ...sources.keys());
  }
  function showGroup() {
    const item = sourceFor(group);
    if (!item) return;
    dialog.querySelector(".sync-title").textContent = `第 ${String(group).padStart(2, "0")} 组 · 细节对比`;
    keys.forEach(key => { dialog.querySelector(`[data-key="${key}"] img`).src = item[key]; });
    dialog.querySelector('[data-action="prev"]').disabled = group <= 1;
    dialog.querySelector('[data-action="next"]').disabled = group >= totalGroups();
    reset();
  }
  function changeGroup(delta) { group = Math.max(1, Math.min(totalGroups(), group + delta)); showGroup(); }
  function close() {
    dialog.classList.remove("open");
    document.body.classList.remove("sync-open");
    drag = null;
    opener?.focus();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-sync]");
    if (!button) return;
    event.stopPropagation();
    if (!dialog) init();
    opener = button;
    group = Number(button.dataset.sync.replace("scene-", ""));
    sources.set(group, { original: button.dataset.original, low2k: button.dataset.low2k, effect4k: button.dataset.effect4k, effect4k0923: button.dataset.effect4k0923 });
    // Populate neighboring groups even when the list is currently filtered.
    document.querySelectorAll("[data-sync]").forEach(item => {
      const number = Number(item.dataset.sync.replace("scene-", ""));
      sources.set(number, { original: item.dataset.original, low2k: item.dataset.low2k, effect4k: item.dataset.effect4k, effect4k0923: item.dataset.effect4k0923 });
    });
    dialog.classList.add("open");
    document.body.classList.add("sync-open");
    showGroup();
    dialog.querySelector(".sync-close").focus();
  });
  document.addEventListener("keydown", event => {
    if (!dialog?.classList.contains("open")) return;
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft") changeGroup(-1);
    if (event.key === "ArrowRight") changeGroup(1);
  });
})();
