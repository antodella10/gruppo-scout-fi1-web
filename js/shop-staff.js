document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "negozio", requireAdmin: true });
  if (!user) return;

  const form = document.getElementById("shop-form");
  const listEl = document.getElementById("shop-admin-list");
  const ordersEl = document.getElementById("shop-orders");
  const sortEl = document.getElementById("shop-admin-sort");
  const alertBox = document.getElementById("shop-alert");
  const formTitle = document.getElementById("shop-form-title");
  const resetBtn = document.getElementById("shop-reset");
  const editHint = document.getElementById("shop-edit-hint");
  const typeSelect = document.getElementById("shop-type-select");
  const urlCache = new Map();

  function flash(msg, ok = true) {
    flashAlert(alertBox, msg, ok);
  }

  function fillTypes(selected = "Divisa") {
    if (!typeSelect) return;
    typeSelect.innerHTML = ShopStore.listTypes()
      .map(
        (t) =>
          `<option value="${escapeHtml(t)}" ${t === selected ? "selected" : ""}>${escapeHtml(t)}</option>`
      )
      .join("");
  }

  function resetForm() {
    form?.reset();
    if (form) form.id.value = "";
    if (form) form.available.checked = true;
    fillTypes("Divisa");
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

  function refreshOrders() {
    if (!ordersEl) return;
    const pending = ShopStore.getOrders({ status: "pending" });
    if (!pending.length) {
      ordersEl.innerHTML = `<div class="empty-state">Nessuna richiesta in attesa.</div>`;
      return;
    }
    ordersEl.innerHTML = pending
      .map(
        (o) => `
      <div class="event-admin-item">
        <div>
          <strong>${escapeHtml(o.itemName)}</strong>
          <span class="shop-item-type"> · ${escapeHtml(o.itemType || "")}</span><br>
          <span style="color:var(--muted)">
            ${escapeHtml(ShopStore.formatPrice(o.itemPrice))} · da ${escapeHtml(o.fromName)}
            ${o.phone ? ` · ${escapeHtml(o.phone)}` : ""}
            ${o.sede ? ` · ritiro ${escapeHtml(o.sede)}` : ""}
            · ${new Date(o.createdAt).toLocaleString("it-IT")}
            ${o.notes ? `<br>${escapeHtml(o.notes)}` : ""}
          </span>
        </div>
        <div class="inline-actions">
          <button type="button" class="btn btn-primary btn-small" data-ord-done="${escapeHtml(o.id)}">Segna fatta</button>
          <button type="button" class="btn btn-ghost btn-small" data-ord-reject="${escapeHtml(o.id)}">Rifiuta</button>
        </div>
      </div>`
      )
      .join("");
  }

  async function refreshList() {
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
        fillTypes(item.type);
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

  ordersEl?.addEventListener("click", (e) => {
    const done = e.target.closest("[data-ord-done]");
    const reject = e.target.closest("[data-ord-reject]");
    try {
      if (done) {
        ShopStore.setOrderStatus(done.dataset.ordDone, "done", user);
        flash("Richiesta segnata come fatta.");
        refreshOrders();
      }
      if (reject) {
        ShopStore.setOrderStatus(reject.dataset.ordReject, "rejected", user);
        flash("Richiesta rifiutata.");
        refreshOrders();
      }
    } catch (err) {
      flash(err.message || "Operazione non riuscita.", false);
    }
  });

  fillTypes("Divisa");
  (async () => {
    await ShopStore.pullRemote?.().catch(() => {});
    refreshOrders();
    await refreshList();
  })();
});
