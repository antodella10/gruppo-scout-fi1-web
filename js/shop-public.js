document.addEventListener("DOMContentLoaded", () => {
  const listEl = document.getElementById("shop-list");
  const sortEl = document.getElementById("shop-sort");
  const countEl = document.getElementById("shop-count");
  const dialog = document.getElementById("shop-order-dialog");
  const orderForm = document.getElementById("shop-order-form");
  const orderLabel = document.getElementById("shop-order-item-label");
  const orderAlert = document.getElementById("shop-order-alert");
  const urlCache = new Map();

  async function imageSrc(imageId) {
    if (!imageId) return "";
    if (urlCache.has(imageId)) return urlCache.get(imageId);
    const url = await ShopStore.getImageUrl(imageId);
    if (url) urlCache.set(imageId, url);
    return url || "";
  }

  function openOrder(itemId) {
    const item = ShopStore.getItem(itemId);
    if (!item || !item.available) return;
    if (!dialog || !orderForm) return;
    orderForm.reset();
    orderForm.itemId.value = item.id;
    if (orderLabel) {
      orderLabel.textContent = `${item.name} · ${ShopStore.formatPrice(item.price)} · ritiro in sede`;
    }
    if (orderAlert) {
      orderAlert.hidden = true;
      orderAlert.textContent = "";
    }
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  async function render() {
    if (!listEl) return;
    const sort = sortEl?.value || "name";
    const items = ShopStore.getItems({ sort });
    if (countEl) {
      countEl.textContent = items.length
        ? `${items.length} oggett${items.length === 1 ? "o" : "i"}`
        : "";
    }
    if (!items.length) {
      listEl.innerHTML = `<div class="empty-state">Il magazzino è ancora vuoto. Torna a trovarci presto!</div>`;
      return;
    }

    listEl.innerHTML = items
      .map(
        (item) => `
      <article class="shop-item" data-id="${escapeHtml(item.id)}">
        <div class="shop-item-media" data-img="${escapeHtml(item.imageId || "")}">
          <div class="shop-item-placeholder">Kala Nag</div>
        </div>
        <div class="shop-item-body">
          <div class="shop-item-top">
            <h2 class="shop-item-name">${escapeHtml(item.name)}</h2>
            <span class="shop-item-type">${escapeHtml(item.type)}</span>
          </div>
          <p class="shop-item-price">${escapeHtml(ShopStore.formatPrice(item.price))}</p>
          <p class="shop-item-avail ${item.available ? "is-yes" : "is-no"}">
            ${escapeHtml(ShopStore.availabilityLabel(item))}
          </p>
          ${item.notes ? `<p class="shop-item-notes">${escapeHtml(item.notes)}</p>` : ""}
          <div class="inline-actions">
            ${
              item.available
                ? `<button type="button" class="btn btn-primary btn-small" data-order="${escapeHtml(item.id)}">Ordina · ritiro in sede</button>`
                : `<span class="hint">Al momento non ordinabile</span>`
            }
          </div>
        </div>
      </article>`
      )
      .join("");

    await Promise.all(
      [...listEl.querySelectorAll("[data-img]")].map(async (media) => {
        const id = media.getAttribute("data-img");
        if (!id) return;
        const src = await imageSrc(id);
        if (!src) return;
        media.innerHTML = `<img src="${src}" alt="">`;
      })
    );
  }

  listEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-order]");
    if (!btn) return;
    openOrder(btn.dataset.order);
  });

  orderForm?.addEventListener("submit", (e) => {
    const submitter = e.submitter;
    if (submitter?.value === "cancel") return;
    e.preventDefault();
    const data = new FormData(orderForm);
    try {
      ShopStore.placeOrder({
        itemId: data.get("itemId"),
        fromName: data.get("fromName"),
        phone: data.get("phone"),
        sede: data.get("sede"),
        notes: data.get("notes"),
      });
      if (orderAlert) {
        orderAlert.hidden = false;
        orderAlert.className = "alert alert-ok";
        orderAlert.textContent = "Richiesta inviata! L’admin la vedrà nell’area negozio.";
      }
      window.setTimeout(() => {
        if (typeof dialog?.close === "function") dialog.close();
        else dialog?.removeAttribute("open");
      }, 900);
    } catch (err) {
      if (orderAlert) {
        orderAlert.hidden = false;
        orderAlert.className = "alert alert-error";
        orderAlert.textContent = err.message || "Invio non riuscito.";
      }
    }
  });

  sortEl?.addEventListener("change", () => {
    render().catch((err) => alert(err.message));
  });

  render().catch((err) => {
    if (listEl) listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  });
});
