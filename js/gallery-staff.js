document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "documenti" });
  if (!user) return;
  if (!GalleryStore.canManage(user)) {
    location.href = "./login.html";
    return;
  }

  const alertBox = document.getElementById("gallery-alert");
  const foldersView = document.getElementById("gal-folders-view");
  const folderView = document.getElementById("gal-folder-view");
  const featuredView = document.getElementById("gal-featured-view");
  const foldersGrid = document.getElementById("gal-folders-grid");
  const unfiledEl = document.getElementById("gal-unfiled");
  const photosGrid = document.getElementById("gal-photos-grid");
  const featuredGrid = document.getElementById("gal-featured-grid");
  const folderTitle = document.getElementById("gal-folder-title");
  const uploadInput = document.getElementById("gal-upload-input");
  const brancaSelect = document.getElementById("gal-upload-branca");
  const progressWrap = document.getElementById("gal-upload-progress");
  const progressBar = document.getElementById("gal-upload-bar");
  const progressStatus = document.getElementById("gal-upload-status");
  const featuredCount = document.getElementById("featured-count");
  const lightbox = document.getElementById("gal-lightbox");
  const lbImg = document.getElementById("gal-lb-img");
  const lbCap = document.getElementById("gal-lb-cap");
  const ctx = document.getElementById("gal-ctx");
  const ctxBackdrop = document.getElementById("gal-ctx-backdrop");

  let items = [];
  let folders = [];
  let currentFolderId = null;
  let featuredDraft = new Set();
  let activePhotoId = null;
  let ctxFolderId = null;
  let longPressTimer = null;
  let suppressFolderClick = false;

  function flash(msg, ok = true) {
    flashAlert(alertBox, msg, ok);
  }

  function showView(name) {
    if (foldersView) foldersView.hidden = name !== "folders";
    if (folderView) folderView.hidden = name !== "folder";
    if (featuredView) featuredView.hidden = name !== "featured";
  }

  function fillBranca() {
    if (!brancaSelect) return;
    brancaSelect.innerHTML = GalleryStore.BRANCHES.map(
      (b) => `<option value="${b.id}">${escapeHtml(b.label)}</option>`
    ).join("");
  }

  function countInFolder(folderId) {
    if (folderId === "__none") return items.filter((i) => !i.folderId).length;
    return items.filter((i) => i.folderId === folderId).length;
  }

  function setProgress(current, total, name) {
    if (!progressWrap) return;
    progressWrap.hidden = false;
    const pct = total ? Math.round((current / total) * 100) : 0;
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressStatus) {
      progressStatus.textContent =
        current >= total
          ? `Completato (${total})`
          : `Caricamento ${current}/${total}${name ? ` · ${name}` : ""}`;
    }
  }

  function hideProgress() {
    if (progressWrap) progressWrap.hidden = true;
    if (progressBar) progressBar.style.width = "0%";
  }

  function renderFolders() {
    if (!foldersGrid) return;
    const cards = folders
      .map((f) => {
        const n = countInFolder(f.id);
        const cover = items.find((i) => i.folderId === f.id);
        return `
        <button type="button" class="gal-folder-card" data-open-folder="${escapeHtml(f.id)}"
          aria-label="${escapeHtml(f.name)}">
          <div class="gal-folder-cover">
            ${
              cover
                ? `<img src="${escapeHtml(GalleryStore.imageUrl(cover.id))}" alt="" loading="lazy">`
                : `<span class="gal-folder-icon" aria-hidden="true">📁</span>`
            }
          </div>
          <strong>${escapeHtml(f.name)}</strong>
          <span class="hint">${n} foto</span>
        </button>`;
      })
      .join("");
    foldersGrid.innerHTML =
      cards || `<div class="empty-state">Nessuna cartella. Tocca + per crearne una.</div>`;

    if (unfiledEl) {
      const n = countInFolder("__none");
      unfiledEl.innerHTML = `
        <button type="button" class="gal-folder-card gal-folder-unfiled" data-open-folder="__none">
          <div class="gal-folder-cover"><span class="gal-folder-icon" aria-hidden="true">🖼</span></div>
          <strong>Senza cartella</strong>
          <span class="hint">${n} foto</span>
        </button>`;
    }
  }

  function photosInCurrentFolder() {
    if (currentFolderId === "__none") return items.filter((i) => !i.folderId);
    return items.filter((i) => i.folderId === currentFolderId);
  }

  function renderPhotos() {
    if (!photosGrid) return;
    const list = photosInCurrentFolder();
    if (!list.length) {
      photosGrid.innerHTML = `<div class="empty-state">Nessuna foto. Usa l’icona di upload per aggiungerne.</div>`;
      return;
    }
    photosGrid.innerHTML = list
      .map(
        (item) => `
      <button type="button" class="gal-photo-tile" data-photo="${escapeHtml(item.id)}"
        aria-label="${escapeHtml(item.title || item.caption || "Foto")}">
        <img src="${escapeHtml(GalleryStore.imageUrl(item.id))}" alt="" loading="lazy">
        ${item.featured ? `<span class="gal-photo-star" title="In evidenza">★</span>` : ""}
      </button>`
      )
      .join("");
  }

  function syncFeaturedCount() {
    if (featuredCount) featuredCount.textContent = `(${featuredDraft.size}/${GalleryStore.FEATURED_MAX})`;
  }

  function renderFeaturedPicker() {
    if (!featuredGrid) return;
    if (!items.length) {
      featuredGrid.innerHTML = `<div class="empty-state">Nessuna foto disponibile.</div>`;
      syncFeaturedCount();
      return;
    }
    featuredGrid.innerHTML = items
      .map((item) => {
        const on = featuredDraft.has(item.id);
        return `
        <button type="button" class="gal-photo-tile ${on ? "is-selected" : ""}" data-feat="${escapeHtml(item.id)}"
          aria-pressed="${on ? "true" : "false"}">
          <img src="${escapeHtml(GalleryStore.imageUrl(item.id))}" alt="" loading="lazy">
          ${on ? `<span class="gal-photo-check">✓</span>` : ""}
        </button>`;
      })
      .join("");
    syncFeaturedCount();
  }

  async function refresh() {
    try {
      const data = await GalleryStore.pull({ force: true });
      items = data.items || [];
      folders = data.folders || [];
      featuredDraft = new Set(GalleryStore.featuredItems(items).map((i) => i.id));
      renderFolders();
      if (!folderView?.hidden) renderPhotos();
      if (!featuredView?.hidden) renderFeaturedPicker();
    } catch (err) {
      flash(err.message || "Errore caricamento galleria.", false);
    }
  }

  function openFolder(folderId) {
    currentFolderId = folderId;
    if (folderTitle) {
      if (folderId === "__none") folderTitle.textContent = "Senza cartella";
      else folderTitle.textContent = folders.find((f) => f.id === folderId)?.name || "Cartella";
    }
    showView("folder");
    renderPhotos();
  }

  function openLightbox(photoId) {
    const item = items.find((i) => i.id === photoId);
    if (!item || !lightbox) return;
    activePhotoId = photoId;
    if (lbImg) lbImg.src = GalleryStore.imageUrl(item.id);
    if (lbCap) lbCap.textContent = [item.title, item.caption].filter(Boolean).join(" — ") || "";
    lightbox.hidden = false;
    document.body.classList.add("gallery-lb-open");
  }

  function closeLightbox() {
    if (lightbox) lightbox.hidden = true;
    document.body.classList.remove("gallery-lb-open");
    activePhotoId = null;
    if (lbImg) lbImg.removeAttribute("src");
  }

  function openCtx(folderId, x, y) {
    ctxFolderId = folderId;
    if (!ctx || !ctxBackdrop) return;
    ctx.hidden = false;
    ctxBackdrop.hidden = false;
    const pad = 12;
    const rect = ctx.getBoundingClientRect();
    const left = Math.min(Math.max(pad, x - rect.width / 2), window.innerWidth - rect.width - pad);
    const top = Math.min(Math.max(pad, y), window.innerHeight - rect.height - pad);
    ctx.style.left = `${left}px`;
    ctx.style.top = `${top}px`;
  }

  function closeCtx() {
    ctxFolderId = null;
    if (ctx) ctx.hidden = true;
    if (ctxBackdrop) ctxBackdrop.hidden = true;
  }

  function clearLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  document.getElementById("folder-add-btn")?.addEventListener("click", async () => {
    const name = prompt("Nome nuova cartella");
    if (!name?.trim()) return;
    try {
      await GalleryStore.createFolder(name.trim(), user);
      flash("Cartella creata.");
      await refresh();
    } catch (err) {
      flash(err.message || "Impossibile creare la cartella.", false);
    }
  });

  document.getElementById("gal-back-folders")?.addEventListener("click", () => {
    currentFolderId = null;
    showView("folders");
    renderFolders();
  });

  document.getElementById("featured-edit-btn")?.addEventListener("click", () => {
    featuredDraft = new Set(GalleryStore.featuredItems(items).map((i) => i.id));
    showView("featured");
    renderFeaturedPicker();
  });

  document.getElementById("featured-cancel")?.addEventListener("click", () => {
    featuredDraft = new Set(GalleryStore.featuredItems(items).map((i) => i.id));
    showView("folders");
  });

  document.getElementById("featured-save")?.addEventListener("click", async () => {
    try {
      await GalleryStore.setFeatured([...featuredDraft], user);
      flash("Foto in evidenza aggiornate.");
      showView("folders");
      await refresh();
    } catch (err) {
      flash(err.message || "Salvataggio fallito.", false);
    }
  });

  featuredGrid?.addEventListener("click", (e) => {
    const tile = e.target.closest("[data-feat]");
    if (!tile) return;
    const id = tile.dataset.feat;
    if (featuredDraft.has(id)) featuredDraft.delete(id);
    else {
      if (featuredDraft.size >= GalleryStore.FEATURED_MAX) {
        flash(`Massimo ${GalleryStore.FEATURED_MAX} foto in evidenza.`, false);
        return;
      }
      featuredDraft.add(id);
    }
    renderFeaturedPicker();
  });

  foldersGrid?.addEventListener("click", (e) => {
    if (suppressFolderClick) {
      suppressFolderClick = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const card = e.target.closest("[data-open-folder]");
    if (!card) return;
    openFolder(card.dataset.openFolder);
  });

  unfiledEl?.addEventListener("click", (e) => {
    const card = e.target.closest("[data-open-folder]");
    if (!card) return;
    openFolder(card.dataset.openFolder);
  });

  function bindLongPress(root) {
    root?.addEventListener("pointerdown", (e) => {
      const card = e.target.closest("[data-open-folder]");
      if (!card || card.dataset.openFolder === "__none") return;
      clearLongPress();
      const x = e.clientX;
      const y = e.clientY;
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        suppressFolderClick = true;
        openCtx(card.dataset.openFolder, x, y);
      }, 520);
    });
    root?.addEventListener("pointerup", clearLongPress);
    root?.addEventListener("pointercancel", clearLongPress);
    root?.addEventListener("pointerleave", clearLongPress);
    root?.addEventListener("contextmenu", (e) => {
      const card = e.target.closest("[data-open-folder]");
      if (!card || card.dataset.openFolder === "__none") return;
      e.preventDefault();
      suppressFolderClick = true;
      openCtx(card.dataset.openFolder, e.clientX, e.clientY);
    });
  }
  bindLongPress(foldersGrid);

  ctx?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-ctx]");
    if (!btn) return;
    const action = btn.dataset.ctx;
    const id = ctxFolderId;
    closeCtx();
    if (!id || action === "cancel") return;
    try {
      if (action === "rename") {
        const folder = folders.find((f) => f.id === id);
        const name = prompt("Nuovo nome cartella", folder?.name || "");
        if (!name?.trim()) return;
        await GalleryStore.renameFolder(id, name.trim(), user);
        flash("Cartella rinominata.");
        await refresh();
      }
      if (action === "delete") {
        if (!confirm("Eliminare la cartella? Le foto restano, senza cartella.")) return;
        await GalleryStore.deleteFolder(id, user);
        flash("Cartella eliminata.");
        await refresh();
      }
    } catch (err) {
      flash(err.message || "Errore cartella.", false);
    }
  });
  ctxBackdrop?.addEventListener("click", closeCtx);

  photosGrid?.addEventListener("click", (e) => {
    const tile = e.target.closest("[data-photo]");
    if (!tile) return;
    openLightbox(tile.dataset.photo);
  });

  let photoLongPress = null;
  photosGrid?.addEventListener("pointerdown", (e) => {
    const tile = e.target.closest("[data-photo]");
    if (!tile) return;
    photoLongPress = setTimeout(() => {
      photoLongPress = null;
      openLightbox(tile.dataset.photo);
    }, 480);
  });
  photosGrid?.addEventListener("pointerup", () => {
    if (photoLongPress) clearTimeout(photoLongPress);
    photoLongPress = null;
  });
  photosGrid?.addEventListener("pointercancel", () => {
    if (photoLongPress) clearTimeout(photoLongPress);
    photoLongPress = null;
  });

  document.getElementById("gal-lb-close")?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.getElementById("gal-lb-move")?.addEventListener("click", async () => {
    const item = items.find((i) => i.id === activePhotoId);
    if (!item) return;
    const options = [
      { id: "", label: "Senza cartella" },
      ...folders.map((f) => ({ id: f.id, label: f.name })),
    ];
    const choice = prompt(
      `Sposta in cartella (numero):\n${options.map((o, i) => `${i + 1}. ${o.label}`).join("\n")}`,
      "1"
    );
    const idx = Number(choice) - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= options.length) return;
    try {
      await GalleryStore.updateMeta(item.id, { folderId: options[idx].id || null }, user);
      flash("Foto spostata.");
      closeLightbox();
      await refresh();
      renderPhotos();
    } catch (err) {
      flash(err.message || "Spostamento fallito.", false);
    }
  });

  document.getElementById("gal-lb-rename")?.addEventListener("click", async () => {
    const item = items.find((i) => i.id === activePhotoId);
    if (!item) return;
    const title = prompt("Titolo / nome foto", item.title || "");
    if (title == null) return;
    try {
      await GalleryStore.updateMeta(item.id, { title: title.trim() }, user);
      flash("Titolo aggiornato.");
      closeLightbox();
      await refresh();
      renderPhotos();
    } catch (err) {
      flash(err.message || "Rinomina fallita.", false);
    }
  });

  document.getElementById("gal-lb-caption")?.addEventListener("click", async () => {
    const item = items.find((i) => i.id === activePhotoId);
    if (!item) return;
    const caption = prompt("Didascalia / descrizione", item.caption || "");
    if (caption == null) return;
    try {
      await GalleryStore.updateMeta(item.id, { caption: caption.trim() }, user);
      flash("Didascalia aggiornata.");
      closeLightbox();
      await refresh();
    } catch (err) {
      flash(err.message || "Salvataggio fallito.", false);
    }
  });

  document.getElementById("gal-lb-delete")?.addEventListener("click", async () => {
    if (!activePhotoId || !confirm("Eliminare questa foto?")) return;
    try {
      await GalleryStore.remove(activePhotoId, user);
      flash("Foto eliminata.");
      closeLightbox();
      await refresh();
      renderPhotos();
    } catch (err) {
      flash(err.message || "Eliminazione fallita.", false);
    }
  });

  uploadInput?.addEventListener("change", async () => {
    const files = uploadInput.files;
    if (!files?.length) return;
    const branca = brancaSelect?.value || "gruppo";
    const folderId = currentFolderId === "__none" ? null : currentFolderId;
    try {
      const result = await GalleryStore.uploadMany(
        { files, title: "", caption: "", branca, folderId },
        user,
        setProgress
      );
      const fail = result.errors.length;
      if (!fail) flash(result.ok.length === 1 ? "Foto caricata." : `${result.ok.length} foto caricate.`);
      else if (result.ok.length) {
        flash(`Caricate ${result.ok.length}/${result.total}. Alcuni errori.`, false);
      } else flash(result.errors[0]?.message || "Upload fallito.", false);
      await refresh();
      renderPhotos();
    } catch (err) {
      flash(err.message || "Upload fallito.", false);
    } finally {
      uploadInput.value = "";
      setTimeout(hideProgress, 800);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLightbox();
      closeCtx();
    }
  });

  fillBranca();
  showView("folders");
  refresh();
});
