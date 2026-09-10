document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "notizie", requireAdmin: true });
  if (!user) return;

  const form = document.getElementById("news-form");
  const listEl = document.getElementById("news-admin-list");
  const alertBox = document.getElementById("news-alert");
  const formTitle = document.getElementById("news-form-title");
  const resetBtn = document.getElementById("news-reset");

  function flash(msg, ok = true) {
    flashAlert(alertBox, msg, ok);
  }

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function resetForm() {
    form?.reset();
    if (form) {
      form.id.value = "";
      form.date.value = todayIso();
    }
    if (formTitle) formTitle.textContent = "Nuova notizia";
    if (resetBtn) resetBtn.hidden = true;
  }

  function refresh() {
    if (!listEl) return;
    const list = NewsStore.getNews();
    if (!list.length) {
      listEl.innerHTML = `<div class="empty-state">Nessuna notizia.</div>`;
      return;
    }
    listEl.innerHTML = list
      .map(
        (n) => `
      <div class="event-admin-item">
        <div>
          <strong>${escapeHtml(n.title)}</strong><br>
          <span style="color:var(--muted)">${escapeHtml(NewsStore.formatDate(n.date))}</span>
          <p style="margin:.45rem 0 0;color:var(--muted)">${escapeHtml(n.body)}</p>
        </div>
        <div class="inline-actions">
          <button type="button" class="btn btn-ghost btn-small" data-edit="${escapeHtml(n.id)}">Modifica</button>
          <button type="button" class="btn btn-ghost btn-small" data-del="${escapeHtml(n.id)}">Elimina</button>
        </div>
      </div>`
      )
      .join("");
  }

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    try {
      NewsStore.upsert(
        {
          id: data.get("id") || "",
          title: data.get("title"),
          date: data.get("date"),
          body: data.get("body"),
        },
        user
      );
      flash(data.get("id") ? "Notizia aggiornata." : "Notizia pubblicata.");
      resetForm();
      refresh();
    } catch (err) {
      flash(err.message || "Salvataggio non riuscito.", false);
    }
  });

  resetBtn?.addEventListener("click", resetForm);

  listEl?.addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    try {
      if (edit) {
        const item = NewsStore.getById(edit.dataset.edit);
        if (!item || !form) return;
        form.id.value = item.id;
        form.title.value = item.title;
        form.date.value = item.date;
        form.body.value = item.body;
        if (formTitle) formTitle.textContent = "Modifica notizia";
        if (resetBtn) resetBtn.hidden = false;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (del) {
        if (!confirm("Eliminare questa notizia?")) return;
        NewsStore.remove(del.dataset.del, user);
        flash("Notizia eliminata.");
        if (form?.id.value === del.dataset.del) resetForm();
        refresh();
      }
    } catch (err) {
      flash(err.message || "Operazione non riuscita.", false);
    }
  });

  resetForm();
  (async () => {
    await NewsStore.pullRemote?.().catch(() => {});
    refresh();
  })();
});
