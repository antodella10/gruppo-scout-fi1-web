document.addEventListener("DOMContentLoaded", () => {
  const listEl = document.getElementById("shop-list");
  const sortEl = document.getElementById("shop-sort");
  const countEl = document.getElementById("shop-count");
  const urlCache = new Map();

  async function imageSrc(imageId) {
    if (!imageId) return "";
    if (urlCache.has(imageId)) return urlCache.get(imageId);
    const url = await ShopStore.getImageUrl(imageId);
    if (url) urlCache.set(imageId, url);
    return url || "";
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
                ? `<a class="btn btn-primary btn-small" href="${ShopStore.orderMailto(item)}">Ordina · ritiro in sede</a>`
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

  sortEl?.addEventListener("change", () => {
    render().catch((err) => alert(err.message));
  });

  render().catch((err) => {
    if (listEl) listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  });
});
