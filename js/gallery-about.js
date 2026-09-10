/* Galleria pubblica dentro Chi siamo: carosello featured + griglia per branca. */
document.addEventListener("DOMContentLoaded", () => {
  const track = document.getElementById("gallery-featured-track");
  const viewport = track?.parentElement;
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
  let physicalPos = 0;
  let animating = false;
  let settleTimer = null;

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

  function loopCopies() {
    return featured.length > 1 ? 3 : 1;
  }

  function markActive() {
    if (!track) return;
    track.querySelectorAll(".gallery-feat-slide").forEach((el) => {
      el.classList.toggle("is-active", Number(el.dataset.featI) === featIndex);
    });
  }

  function scrollToPhysical(pos, smooth) {
    if (!track || !viewport) return;
    const el = track.children[pos];
    if (!el) return;
    const left = el.offsetLeft - (viewport.clientWidth - el.clientWidth) / 2;
    viewport.scrollTo({ left: Math.max(0, left), behavior: smooth ? "smooth" : "auto" });
  }

  function normalizeLoop() {
    const n = featured.length;
    if (n < 2 || loopCopies() < 3) return;
    if (physicalPos < n) {
      physicalPos += n;
      scrollToPhysical(physicalPos, false);
    } else if (physicalPos >= n * 2) {
      physicalPos -= n;
      scrollToPhysical(physicalPos, false);
    }
  }

  function scheduleNormalize() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      normalizeLoop();
      animating = false;
    }, 380);
  }

  function renderFeatured() {
    if (!track) return;
    if (!featured.length) {
      track.innerHTML = "";
      physicalPos = 0;
      featIndex = 0;
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

    const copies = loopCopies();
    const parts = [];
    for (let c = 0; c < copies; c++) {
      featured.forEach((item, i) => {
        parts.push(`
      <button type="button" class="gallery-feat-slide ${i === featIndex ? "is-active" : ""}" data-feat-id="${escapeHtml(item.id)}" data-feat-i="${i}" data-copy="${c}">
        <img src="${escapeHtml(GalleryStore.imageUrl(item.id))}" alt="${escapeHtml(item.title || "Foto")}" loading="${c === 1 && i < 3 ? "eager" : "lazy"}" draggable="false">
        ${overlayHtml(item)}
      </button>`);
      });
    }
    track.innerHTML = parts.join("");

    const n = featured.length;
    physicalPos = copies === 3 ? n + (featIndex % n) : featIndex % n;
    requestAnimationFrame(() => {
      scrollToPhysical(physicalPos, false);
      markActive();
    });
  }

  function shiftFeat(dir) {
    if (!featured.length || featured.length < 2 || animating) return;
    animating = true;
    physicalPos += dir;
    const n = featured.length;
    featIndex = ((physicalPos % n) + n) % n;
    markActive();
    scrollToPhysical(physicalPos, true);
    scheduleNormalize();
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
