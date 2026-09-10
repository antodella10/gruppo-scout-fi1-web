document.addEventListener("DOMContentLoaded", () => {
  BranchView.persist("gruppo", { updateUrl: false });

  const grid = document.getElementById("gallery-grid");
  const status = document.getElementById("gallery-status");
  const lightbox = document.getElementById("gallery-lightbox");
  const lbImg = document.getElementById("gallery-lb-img");
  const lbCap = document.getElementById("gallery-lb-cap");
  const lbClose = document.getElementById("gallery-lb-close");

  function openLb(item) {
    if (!lightbox || !lbImg) return;
    lbImg.src = GalleryStore.imageUrl(item.id);
    lbImg.alt = item.title || "Foto";
    if (lbCap) {
      const parts = [item.title, item.caption].filter(Boolean);
      lbCap.textContent = parts.join(" — ");
    }
    lightbox.hidden = false;
    document.body.classList.add("gallery-lb-open");
  }

  function closeLb() {
    if (!lightbox) return;
    lightbox.hidden = true;
    document.body.classList.remove("gallery-lb-open");
    if (lbImg) lbImg.removeAttribute("src");
  }

  lbClose?.addEventListener("click", closeLb);
  lightbox?.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLb();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLb();
  });

  (async () => {
    if (status) status.textContent = "Caricamento galleria…";
    try {
      const items = await GalleryStore.listItems({ force: true });
      if (!items.length) {
        if (status) status.textContent = "La galleria è ancora vuota. Presto arriveranno le foto del gruppo.";
        if (grid) grid.innerHTML = "";
        return;
      }
      if (status) status.hidden = true;
      grid.innerHTML = items
        .map(
          (item) => `
        <button type="button" class="gallery-card" data-id="${escapeHtml(item.id)}">
          <img src="${escapeHtml(GalleryStore.imageUrl(item.id))}" alt="${escapeHtml(item.title || "Foto Firenze 1")}" loading="lazy">
          <span class="gallery-card-meta">
            <strong>${escapeHtml(item.title || "Foto")}</strong>
            ${item.caption ? `<span>${escapeHtml(item.caption)}</span>` : ""}
          </span>
        </button>`
        )
        .join("");

      grid.addEventListener("click", (e) => {
        const card = e.target.closest("[data-id]");
        if (!card) return;
        const item = items.find((x) => x.id === card.dataset.id);
        if (item) openLb(item);
      });
    } catch (err) {
      if (status) {
        status.hidden = false;
        status.textContent = err.message || "Impossibile caricare la galleria.";
      }
    }
  })();
});
