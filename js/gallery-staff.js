document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "galleria" });
  if (!user) return;
  if (!GalleryStore.canManage(user)) {
    location.href = "./login.html";
    return;
  }

  const form = document.getElementById("gallery-form");
  const photosInput = document.getElementById("gallery-photos");
  const fileHint = document.getElementById("gallery-file-hint");
  const progressWrap = document.getElementById("gallery-upload-progress");
  const progressBar = document.getElementById("gallery-upload-bar");
  const progressStatus = document.getElementById("gallery-upload-status");
  const uploadBtn = document.getElementById("gallery-upload-btn");
  const folderForm = document.getElementById("folder-form");
  const listEl = document.getElementById("gallery-admin-list");
  const folderList = document.getElementById("folder-list");
  const brancaSelect = document.getElementById("gallery-branca");
  const folderSelect = document.getElementById("gallery-folder");
  const filterFolder = document.getElementById("filter-folder");
  const featuredCount = document.getElementById("featured-count");
  const featuredSave = document.getElementById("featured-save");
  const alertBox = document.getElementById("gallery-alert");

  let items = [];
  let folders = [];
  let featuredDraft = new Set();

  function flash(msg, ok = true) {
    flashAlert(alertBox, msg, ok);
  }

  function fillBranchSelect() {
    if (!brancaSelect) return;
    brancaSelect.innerHTML = GalleryStore.BRANCHES.map(
      (b) => `<option value="${b.id}">${escapeHtml(b.label)}</option>`
    ).join("");
  }

  function fillFolderSelects() {
    const opts =
      `<option value="">Nessuna cartella</option>` +
      folders.map((f) => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join("");
    if (folderSelect) folderSelect.innerHTML = opts;
    if (filterFolder) {
      filterFolder.innerHTML =
        `<option value="">Tutte le foto</option>` +
        `<option value="__none">Senza cartella</option>` +
        folders.map((f) => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join("");
    }
  }

  function syncFeaturedCount() {
    if (featuredCount) featuredCount.textContent = `(${featuredDraft.size}/${GalleryStore.FEATURED_MAX})`;
  }

  function visibleItems() {
    const fold = filterFolder?.value || "";
    if (!fold) return items;
    if (fold === "__none") return items.filter((i) => !i.folderId);
    return items.filter((i) => i.folderId === fold);
  }

  function updateFileHint() {
    if (!fileHint || !photosInput) return;
    const n = photosInput.files?.length || 0;
    if (!n) {
      fileHint.hidden = true;
      fileHint.textContent = "";
      return;
    }
    fileHint.hidden = false;
    fileHint.textContent = n === 1 ? "1 foto selezionata" : `${n} foto selezionate`;
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
    if (!folderList) return;
    if (!folders.length) {
      folderList.innerHTML = `<div class="empty-state">Nessuna cartella.</div>`;
      return;
    }
    folderList.innerHTML = folders
      .map(
        (f) => `
      <div class="event-admin-item">
        <div><strong>${escapeHtml(f.name)}</strong></div>
        <div class="inline-actions">
          <button type="button" class="btn btn-ghost btn-small" data-rename-folder="${escapeHtml(f.id)}">Rinomina</button>
          <button type="button" class="btn btn-ghost btn-small" data-del-folder="${escapeHtml(f.id)}">Elimina</button>
        </div>
      </div>`
      )
      .join("");
  }

  function renderList() {
    if (!listEl) return;
    const list = visibleItems();
    if (!list.length) {
      listEl.innerHTML = `<div class="empty-state">Nessuna foto qui.</div>`;
      syncFeaturedCount();
      return;
    }
    listEl.innerHTML = list
      .map((item) => {
        const on = featuredDraft.has(item.id);
        const label = item.title || item.caption || "Senza titolo";
        return `
        <article class="gallery-admin-item ${on ? "is-featured" : ""}" data-toggle-feat="${escapeHtml(item.id)}" role="button" tabindex="0" aria-pressed="${on ? "true" : "false"}">
          <img src="${escapeHtml(GalleryStore.imageUrl(item.id))}" alt="" loading="lazy">
          <div>
            <strong>${escapeHtml(label)}</strong>
            <p class="hint">${escapeHtml(GalleryStore.branchLabel(item.branca))}${
              on ? " · In primo piano" : ""
            }${item.title && item.caption ? " · " + escapeHtml(item.caption) : ""}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-small" data-del="${escapeHtml(item.id)}">Elimina</button>
        </article>`;
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
      fillFolderSelects();
      renderFolders();
      renderList();
    } catch (err) {
      flash(err.message || "Errore caricamento galleria.", false);
    }
  }

  fillBranchSelect();
  photosInput?.addEventListener("change", updateFileHint);

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const files = photosInput?.files;
    if (!files?.length) {
      flash("Scegli almeno una foto.", false);
      return;
    }
    if (uploadBtn) uploadBtn.disabled = true;
    try {
      const result = await GalleryStore.uploadMany(
        {
          files,
          title: data.get("title"),
          caption: data.get("caption"),
          branca: data.get("branca"),
          folderId: data.get("folderId") || null,
        },
        user,
        setProgress
      );
      form.reset();
      fillBranchSelect();
      fillFolderSelects();
      updateFileHint();
      const fail = result.errors.length;
      if (!fail) {
        flash(result.ok.length === 1 ? "Foto caricata." : `${result.ok.length} foto caricate.`);
      } else if (result.ok.length) {
        flash(
          `Caricate ${result.ok.length}/${result.total}. Errori: ${result.errors
            .slice(0, 3)
            .map((x) => x.name)
            .join(", ")}${fail > 3 ? "…" : ""}`,
          false
        );
      } else {
        flash(result.errors[0]?.message || "Upload fallito.", false);
      }
      await refresh();
    } catch (err) {
      flash(err.message || "Upload fallito.", false);
    } finally {
      if (uploadBtn) uploadBtn.disabled = false;
      setTimeout(hideProgress, 900);
    }
  });

  folderForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = new FormData(folderForm).get("name");
    try {
      await GalleryStore.createFolder(name, user);
      folderForm.reset();
      flash("Cartella creata.");
      await refresh();
    } catch (err) {
      flash(err.message || "Impossibile creare la cartella.", false);
    }
  });

  folderList?.addEventListener("click", async (e) => {
    const ren = e.target.closest("[data-rename-folder]");
    const del = e.target.closest("[data-del-folder]");
    try {
      if (ren) {
        const folder = folders.find((f) => f.id === ren.dataset.renameFolder);
        const name = prompt("Nuovo nome cartella", folder?.name || "");
        if (!name) return;
        await GalleryStore.renameFolder(ren.dataset.renameFolder, name, user);
        flash("Cartella rinominata.");
        await refresh();
      }
      if (del) {
        if (!confirm("Eliminare la cartella? Le foto restano, senza cartella.")) return;
        await GalleryStore.deleteFolder(del.dataset.delFolder, user);
        flash("Cartella eliminata.");
        await refresh();
      }
    } catch (err) {
      flash(err.message || "Errore cartella.", false);
    }
  });

  listEl?.addEventListener("click", async (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      if (!confirm("Eliminare questa foto?")) return;
      try {
        await GalleryStore.remove(del.dataset.del, user);
        featuredDraft.delete(del.dataset.del);
        flash("Foto eliminata.");
        await refresh();
      } catch (err) {
        flash(err.message || "Eliminazione fallita.", false);
      }
      return;
    }

    const row = e.target.closest("[data-toggle-feat]");
    if (!row) return;
    const id = row.dataset.toggleFeat;
    if (featuredDraft.has(id)) {
      featuredDraft.delete(id);
    } else {
      if (featuredDraft.size >= GalleryStore.FEATURED_MAX) {
        flash(`Massimo ${GalleryStore.FEATURED_MAX} foto in primo piano.`, false);
        return;
      }
      featuredDraft.add(id);
    }
    renderList();
  });

  listEl?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest("[data-toggle-feat]");
    if (!row || e.target.closest("[data-del]")) return;
    e.preventDefault();
    row.click();
  });

  filterFolder?.addEventListener("change", renderList);

  featuredSave?.addEventListener("click", async () => {
    try {
      await GalleryStore.setFeatured([...featuredDraft], user);
      flash("Primo piano aggiornato.");
      await refresh();
    } catch (err) {
      flash(err.message || "Salvataggio fallito.", false);
    }
  });

  refresh();
});
