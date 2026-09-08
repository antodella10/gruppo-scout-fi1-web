document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "negozio", requireAdmin: true });
  if (!user) return;

  const form = document.getElementById("shop-form");
  const listEl = document.getElementById("shop-admin-list");
  const sortEl = document.getElementById("shop-admin-sort");
  const alertBox = document.getElementById("shop-alert");
  const formTitle = document.getElementById("shop-form-title");
  const resetBtn = document.getElementById("shop-reset");
  const editHint = document.getElementById("shop-edit-hint");
  const typesList = document.getElementById("shop-types");
  const urlCache = new Map();

  function flash(msg, ok = true) {
    flashAlert(alertBox, msg, ok);
  }

  function fillTypes() {
    if (!typesList) return;
    typesList.innerHTML = ShopStore.listTypes()
      .map((t) => `<option value="${escapeHtml(t)}"></option>`)
      .join("");
  }

  function resetForm() {
    form?.reset();
    if (form) form.id.value = "";
    if (form) form.available.checked = true;
    if (formTitle) formTitle.textContent = "Nuovo oggetto";
    if (resetBtn) resetBtn.hidden = true;
    if (editHint) editHint.hidden = true;
  }

  async function thumb(imageId) {
    if (!imageId) return "";
    if (urlCache.has(imageId)) return urlCache.get(imageId);
    const url = await ShopStore.getImageUrl(imageId);
    if (url) urlCache.set(imageId, url);
    return url || "";
  }

  async function refreshList() {
    fillTypes();
    if (!listEl) return;
    const items = ShopStore.getItems({ sort: sortEl?.value || "name" });
    if (!items.length) {
      listEl.innerHTML = `<div class="empty-state">Nessun oggetto. Aggiungine uno dal modulo.</div>`;
      return;
    }
    listEl.innerHTML = items
      .map(
        (item) => `
      <div class="shop-admin-row" data-id="${escapeHtml(item.id)}">
        <div class="shop-admin-thumb" data-img="${escapeHtml(item.imageId || "")}">
          <span>No foto</span>
        </div>
        <div class="shop-admin-meta">
          <strong>${escapeHtml(item.name)}</strong>
          <span class="shop-item-type">${escapeHtml(item.type)}</span>
          <div>${escapeHtml(ShopStore.formatPrice(item.price))} · ${escapeHtml(ShopStore.availabilityLabel(item))}</div>
        </div>
        <div class="inline-actions">
          <button type="button" class="btn btn-ghost btn-small" data-edit="${escapeHtml(item.id)}">Modifica</button>
          <button type="button" class="btn btn-ghost btn-small" data-del="${escapeHtml(item.id)}">Elimina</button>
        </div>
      </div>`
      )
      .join("");

    await Promise.all(
      [...listEl.querySelectorAll("[data-img]")].map(async (el) => {
        const id = el.getAttribute("data-img");
        if (!id) return;
        const src = await thumb(id);
        if (src) el.innerHTML = `<img src="${src}" alt="">`;
      })
    );
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    try {
      await ShopStore.upsertItem(
        {
          id: data.get("id") || "",
          name: data.get("name"),
          price: data.get("price"),
          type: data.get("type"),
          available: form.available.checked,
          stockLabel: data.get("stockLabel"),
          notes: data.get("notes"),
        },
        user,
        form.image.files?.[0] || null
      );
      flash(data.get("id") ? "Oggetto aggiornato." : "Oggetto aggiunto.");
      resetForm();
      await refreshList();
    } catch (err) {
      flash(err.message || "Salvataggio non riuscito.", false);
    }
  });

  resetBtn?.addEventListener("click", resetForm);
  sortEl?.addEventListener("change", () => refreshList());

  listEl?.addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    try {
      if (edit) {
        const item = ShopStore.getItem(edit.dataset.edit);
        if (!item || !form) return;
        form.id.value = item.id;
        form.name.value = item.name;
        form.price.value = item.price;
        form.type.value = item.type;
        form.available.checked = !!item.available;
        form.stockLabel.value = item.stockLabel || "";
        form.notes.value = item.notes || "";
        form.image.value = "";
        if (formTitle) formTitle.textContent = "Modifica oggetto";
        if (resetBtn) resetBtn.hidden = false;
        if (editHint) editHint.hidden = false;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (del) {
        if (!confirm("Eliminare questo oggetto dal negozio?")) return;
        await ShopStore.deleteItem(del.dataset.del, user);
        flash("Oggetto eliminato.");
        if (form?.id.value === del.dataset.del) resetForm();
        await refreshList();
      }
    } catch (err) {
      flash(err.message || "Operazione non riuscita.", false);
    }
  });

  refreshList();
});
