document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "galleria", requireAdmin: true });
  if (!user) return;

  const form = document.getElementById("gallery-form");
  const listEl = document.getElementById("gallery-admin-list");
  const alertBox = document.getElementById("gallery-alert");

  function flash(msg, ok = true) {
    flashAlert(alertBox, msg, ok);
  }

  async function refresh() {
    if (!listEl) return;
    listEl.innerHTML = `<div class="empty-state">Caricamento…</div>`;
    try {
      const items = await GalleryStore.listItems({ force: true });
      if (!items.length) {
        listEl.innerHTML = `<div class="empty-state">Nessuna foto in galleria.</div>`;
        return;
      }
      listEl.innerHTML = items
        .map((item) => {
          const src = GalleryStore.imageUrl(item.id);
          return `
          <article class="gallery-admin-item">
            <img src="${escapeHtml(src)}" alt="${escapeHtml(item.title || "Foto")}" loading="lazy">
            <div>
              <strong>${escapeHtml(item.title || "Senza titolo")}</strong>
              <p class="hint">${escapeHtml(item.caption || "—")}</p>
              <p class="hint">${new Date(item.createdAt).toLocaleString("it-IT")}</p>
            </div>
            <button type="button" class="btn btn-ghost btn-small" data-del="${escapeHtml(item.id)}">Elimina</button>
          </article>`;
        })
        .join("");
    } catch (err) {
      listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message || "Errore")}</div>`;
    }
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const file = data.get("photo");
    if (!(file instanceof File) || !file.size) {
      flash("Scegli una foto da caricare.", false);
      return;
    }
    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      await GalleryStore.upload(
        {
          file,
          title: data.get("title"),
          caption: data.get("caption"),
        },
        user
      );
      form.reset();
      flash("Foto pubblicata in galleria.");
      await refresh();
    } catch (err) {
      flash(err.message || "Upload fallito.", false);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  listEl?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;
    if (!confirm("Eliminare questa foto dalla galleria?")) return;
    try {
      await GalleryStore.remove(btn.dataset.del, user);
      flash("Foto eliminata.");
      await refresh();
    } catch (err) {
      flash(err.message || "Eliminazione fallita.", false);
    }
  });

  refresh();
});
