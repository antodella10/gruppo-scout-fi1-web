/* Galleria pubblica dentro Chi siamo: carosello featured + griglia per branca. */
document.addEventListener("DOMContentLoaded", () => {
  const track = document.getElementById("gallery-featured-track");
  const prevBtn = document.getElementById("gallery-feat-prev");
  const nextBtn = document.getElementById("gallery-feat-next");
  const branchSelect = document.getElementById("gallery-branca-select");
  const branchGrid = document.getElementById("gallery-branch-grid");
  const featStatus = document.getElementById("gallery-feat-status");
  const branchStatus = document.getElementById("gallery-branch-status");
  const lightbox = document.getElementById("gallery-lightbox");
  const lbImg = document.getElementById("gallery-lb-img");
  const lbCap = document.getElementById("gallery-lb-cap");
  const lbClose = document.getElementById("gallery-lb-close");

  let allItems = [];
  let featured = [];
  let featIndex = 0;

  function overlayHtml(item) {
    const title = String(item.title || "").trim();
    const caption = String(item.caption || "").trim();
    if (!title && !caption) return "";
    return `<span class="gallery-hover-label">${
      title ? `<strong>${escapeHtml(title)}</strong>` : ""
    }${caption ? `<span>${escapeHtml(caption)}</span>` : ""}</span>`;
  }

  function openLb(item) {
    if (!lightbox || !lbImg || !item) return;
    lbImg.src = GalleryStore.imageUrl(item.id);
    lbImg.alt = item.title || "Foto";
    if (lbCap) {
      const parts = [item.title, item.caption].filter((x) => String(x || "").trim());
      lbCap.textContent = parts.join(" — ");
      lbCap.hidden = !parts.length;
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

  function renderFeatured() {
    if (!track) return;
    if (!featured.length) {
      track.innerHTML = "";
      if (featStatus) {
        featStatus.hidden = false;
        featStatus.textContent = "Ancora nessuna foto in primo piano.";
      }
      if (prevBtn) prevBtn.hidden = true;
      if (nextBtn) nextBtn.hidden = true;
      return;
    }
    if (featStatus) featStatus.hidden = true;
    if (prevBtn) prevBtn.hidden = featured.length < 2;
    if (nextBtn) nextBtn.hidden = featured.length < 2;

    track.innerHTML = featured
      .map(
        (item, i) => `
      <button type="button" class="gallery-feat-slide ${i === featIndex ? "is-active" : ""}" data-feat-id="${escapeHtml(item.id)}" data-feat-i="${i}">
        <img src="${escapeHtml(GalleryStore.imageUrl(item.id))}" alt="${escapeHtml(item.title || "Foto")}" loading="${i < 3 ? "eager" : "lazy"}">
        ${overlayHtml(item)}
      </button>`
      )
      .join("");

    requestAnimationFrame(() => {
      const active = track.querySelector(".gallery-feat-slide.is-active");
      const viewport = track.parentElement;
      if (!active || !viewport) return;
      const left = active.offsetLeft - (viewport.clientWidth - active.clientWidth) / 2;
      viewport.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    });
  }

  function shiftFeat(dir) {
    if (!featured.length) return;
    featIndex = (featIndex + dir + featured.length) % featured.length;
    renderFeatured();
  }

  prevBtn?.addEventListener("click", () => shiftFeat(-1));
  nextBtn?.addEventListener("click", () => shiftFeat(1));

  track?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-feat-id]");
    if (!btn) return;
    const item = featured.find((x) => x.id === btn.dataset.featId);
    if (item) openLb(item);
  });

  function fillBranchSelect() {
    if (!branchSelect) return;
    branchSelect.innerHTML =
      `<option value="tutte">Tutte</option>` +
      GalleryStore.BRANCHES.map((b) => `<option value="${b.id}">${escapeHtml(b.label)}</option>`).join("");
  }

  function renderBranchGrid() {
    if (!branchGrid) return;
    const branca = branchSelect?.value || "tutte";
    const list = GalleryStore.byBranca(allItems, branca);
    if (!list.length) {
      branchGrid.innerHTML = "";
      if (branchStatus) {
        branchStatus.hidden = false;
        branchStatus.textContent =
          branca === "tutte" ? "Nessuna foto in galleria." : "Nessuna foto per questa branca.";
      }
      return;
    }
    if (branchStatus) branchStatus.hidden = true;
    branchGrid.innerHTML = list
      .map(
        (item) => `
      <button type="button" class="gallery-card" data-id="${escapeHtml(item.id)}">
        <img src="${escapeHtml(GalleryStore.imageUrl(item.id))}" alt="${escapeHtml(item.title || "Foto")}" loading="lazy">
        ${overlayHtml(item)}
      </button>`
      )
      .join("");
  }

  branchGrid?.addEventListener("click", (e) => {
    const card = e.target.closest("[data-id]");
    if (!card) return;
    const item = allItems.find((x) => x.id === card.dataset.id);
    if (item) openLb(item);
  });

  branchSelect?.addEventListener("change", renderBranchGrid);

  fillBranchSelect();

  (async () => {
    try {
      allItems = await GalleryStore.listItems({ force: true });
      featured = GalleryStore.featuredItems(allItems);
      featIndex = 0;
      renderFeatured();
      renderBranchGrid();
    } catch (err) {
      if (featStatus) {
        featStatus.hidden = false;
        featStatus.textContent = err.message || "Impossibile caricare la galleria.";
      }
      if (branchStatus) {
        branchStatus.hidden = false;
        branchStatus.textContent = err.message || "Impossibile caricare la galleria.";
      }
    }
  })();
});
