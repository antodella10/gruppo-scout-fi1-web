document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "galleria" });
  if (!user) return;
  if (!GalleryStore.canManage(user)) {
    location.href = "./login.html";
    return;
  }

  const form = document.getElementById("gallery-form");
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
        const checked = featuredDraft.has(item.id) ? "checked" : "";
        const disabled =
          !featuredDraft.has(item.id) && featuredDraft.size >= GalleryStore.FEATURED_MAX ? "disabled" : "";
        return `
        <article class="gallery-admin-item">
          <img src="${escapeHtml(GalleryStore.imageUrl(item.id))}" alt="" loading="lazy">
          <div>
            <label class="gallery-feat-check">
              <input type="checkbox" data-feat="${escapeHtml(item.id)}" ${checked} ${disabled}>
              In primo piano
            </label>
            <strong>${escapeHtml(item.title || "Senza titolo")}</strong>
            <p class="hint">${escapeHtml(GalleryStore.branchLabel(item.branca))}${
              item.caption ? " · " + escapeHtml(item.caption) : ""
            }</p>
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

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const file = data.get("photo");
    if (!(file instanceof File) || !file.size) {
      flash("Scegli una foto.", false);
      return;
    }
    const btn = form.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      await GalleryStore.upload(
        {
          file,
          title: data.get("title"),
          caption: data.get("caption"),
          branca: data.get("branca"),
          folderId: data.get("folderId") || null,
        },
        user
      );
      form.reset();
      fillBranchSelect();
      fillFolderSelects();
      flash("Foto caricata.");
      await refresh();
    } catch (err) {
      flash(err.message || "Upload fallito.", false);
    } finally {
      if (btn) btn.disabled = false;
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

  listEl?.addEventListener("change", (e) => {
    const box = e.target.closest("[data-feat]");
    if (!box) return;
    const id = box.dataset.feat;
    if (box.checked) {
      if (featuredDraft.size >= GalleryStore.FEATURED_MAX) {
        box.checked = false;
        flash(`Massimo ${GalleryStore.FEATURED_MAX} foto in primo piano.`, false);
        return;
      }
      featuredDraft.add(id);
    } else {
      featuredDraft.delete(id);
    }
    renderList();
  });

  listEl?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;
    if (!confirm("Eliminare questa foto?")) return;
    try {
      await GalleryStore.remove(btn.dataset.del, user);
      featuredDraft.delete(btn.dataset.del);
      flash("Foto eliminata.");
      await refresh();
    } catch (err) {
      flash(err.message || "Eliminazione fallita.", false);
    }
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
