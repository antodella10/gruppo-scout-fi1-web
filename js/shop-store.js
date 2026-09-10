/* Negozio “Magazzino di Kala Nag”: meta in localStorage, immagini in IndexedDB. */

const ShopStore = (() => {
  const META_KEY = "firenze1_shop_meta_v1";
  const DB_NAME = "firenze1_shop_db";
  const STORE = "images";
  const TYPES = ["Divisa", "Distintivi", "Attrezzatura", "Altro"];
  const TYPE_ALIASES = {
    abbigliamento: "Divisa",
    accessori: "Distintivi",
    materiale: "Attrezzatura",
    libri: "Altro",
    divisa: "Divisa",
    distintivi: "Distintivi",
    attrezzatura: "Attrezzatura",
    altro: "Altro",
  };

  function readMeta() {
    try {
      const raw = localStorage.getItem(META_KEY);
      return raw ? JSON.parse(raw) : { items: [] };
    } catch {
      return { items: [] };
    }
  }

  function writeMeta(meta) {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  }

  async function pushMeta() {
    if (typeof CloudSync === "undefined") return;
    await CloudSync.putShopMeta(readMeta());
  }

  async function pullRemote() {
    if (typeof CloudSync === "undefined") return false;
    const remote = await CloudSync.getShopMeta();
    if (!remote) return false;
    const hasRemote =
      (Array.isArray(remote.items) && remote.items.length) ||
      (Array.isArray(remote.orders) && remote.orders.length);
    const local = readMeta();
    const hasLocal =
      (local.items || []).length || (local.orders || []).length;
    if (hasRemote) {
      writeMeta({
        items: Array.isArray(remote.items) ? remote.items : [],
        orders: Array.isArray(remote.orders) ? remote.orders : [],
      });
      return true;
    }
    if (hasLocal) await pushMeta();
    return false;
  }

  function uid(prefix = "shop") {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function putImage(id, blob) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ id, blob, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getImage(id) {
    if (!id) return null;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(tx.error);
    });
  }

  async function deleteImage(id) {
    if (!id) return;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function fileToJpegBlob(file, maxSide = 900, quality = 0.82) {
    if (!file || !file.type.startsWith("image/")) {
      throw new Error("Carica un’immagine (JPG, PNG, WebP…).");
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new Error("Immagine troppo grande (max 8 MB).");
    }
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("Impossibile elaborare l’immagine.");
    return blob;
  }

  function normalizeType(value) {
    const raw = String(value || "").trim();
    if (!raw) return "Altro";
    const mapped = TYPE_ALIASES[raw.toLowerCase()];
    if (mapped) return mapped;
    const exact = TYPES.find((t) => t.toLowerCase() === raw.toLowerCase());
    return exact || "Altro";
  }

  function normalizeItem(raw) {
    return {
      id: raw.id,
      name: String(raw.name || "").trim(),
      price: Number(raw.price) || 0,
      available: raw.available !== false && raw.available !== 0 && raw.available !== "0",
      stockLabel: String(raw.stockLabel || "").trim(),
      type: normalizeType(raw.type),
      imageId: raw.imageId || null,
      notes: String(raw.notes || "").trim(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
  }

  function listTypes() {
    return [...TYPES];
  }

  function getItems({ sort = "name" } = {}) {
    const items = (readMeta().items || []).map(normalizeItem);
    if (sort === "type") {
      return items.sort(
        (a, b) =>
          a.type.localeCompare(b.type, "it", { sensitivity: "base" }) ||
          a.name.localeCompare(b.name, "it", { sensitivity: "base" })
      );
    }
    return items.sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" }));
  }

  function getItem(id) {
    return getItems().find((i) => i.id === id) || null;
  }

  function canManage(user) {
    if (!user) return false;
    return typeof ScoutStore !== "undefined" && ScoutStore.isAdminUser?.(user);
  }

  async function getImageUrl(imageId) {
    const rec = await getImage(imageId);
    if (rec?.blob) return URL.createObjectURL(rec.blob);
    if (typeof CloudSync !== "undefined" && CloudSync.available()) {
      try {
        const url = await CloudSync.fileUrl("file", imageId);
        const res = await fetch(url, { credentials: "omit" });
        if (!res.ok) return null;
        const blob = await res.blob();
        await putImage(imageId, blob).catch(() => {});
        return URL.createObjectURL(blob);
      } catch {
        return null;
      }
    }
    return null;
  }

  async function upsertItem(payload, user, imageFile) {
    if (!canManage(user)) throw new Error("Solo l’admin può gestire il negozio.");
    const name = String(payload.name || "").trim();
    if (!name) throw new Error("Inserisci il nome dell’oggetto.");
    const price = Number(payload.price);
    if (!Number.isFinite(price) || price < 0) throw new Error("Prezzo non valido.");

    const meta = readMeta();
    meta.items = meta.items || [];
    let item = payload.id ? meta.items.find((x) => x.id === payload.id) : null;
    if (!item) {
      item = { id: uid("item"), imageId: null };
      meta.items.push(item);
    }

    item.name = name;
    item.price = price;
    item.available = payload.available !== false && payload.available !== "0" && payload.available !== 0;
    item.stockLabel = String(payload.stockLabel || "").trim();
    item.type = normalizeType(payload.type);
    item.notes = String(payload.notes || "").trim();
    item.updatedAt = new Date().toISOString();

    if (imageFile) {
      const blob = await fileToJpegBlob(imageFile);
      const oldId = item.imageId;
      const imageId = uid("img");
      await putImage(imageId, blob);
      item.imageId = imageId;
      if (typeof CloudSync !== "undefined") {
        const file = new File([blob], `${imageId}.jpg`, { type: "image/jpeg" });
        await CloudSync.uploadFile(imageId, file).catch((err) => console.warn(err));
        if (oldId) await CloudSync.deleteFile(oldId);
      }
      if (oldId) await deleteImage(oldId).catch(() => {});
    }

    writeMeta(meta);
    await pushMeta();
    return normalizeItem(item);
  }

  async function deleteItem(id, user) {
    if (!canManage(user)) throw new Error("Solo l’admin può gestire il negozio.");
    const meta = readMeta();
    const item = (meta.items || []).find((x) => x.id === id);
    if (!item) return;
    meta.items = meta.items.filter((x) => x.id !== id);
    writeMeta(meta);
    if (item.imageId) {
      await deleteImage(item.imageId).catch(() => {});
      if (typeof CloudSync !== "undefined") await CloudSync.deleteFile(item.imageId);
    }
    await pushMeta();
  }

  function getOrders({ status } = {}) {
    const orders = [...(readMeta().orders || [])].sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || "")
    );
    if (status) return orders.filter((o) => o.status === status);
    return orders;
  }

  function pendingOrdersCount() {
    return getOrders({ status: "pending" }).length;
  }

  async function placeOrder({ itemId, fromName, phone, sede, notes }) {
    await pullRemote().catch(() => {});
    const item = getItem(itemId);
    if (!item) throw new Error("Oggetto non trovato.");
    if (!item.available) throw new Error("Questo oggetto non è disponibile.");
    const name = String(fromName || "").trim();
    if (!name) throw new Error("Inserisci nome e cognome.");
    const meta = readMeta();
    meta.orders = meta.orders || [];
    const order = {
      id: uid("ord"),
      itemId: item.id,
      itemName: item.name,
      itemType: item.type,
      itemPrice: item.price,
      fromName: name,
      phone: String(phone || "").trim(),
      sede: String(sede || "").trim(),
      notes: String(notes || "").trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    meta.orders.unshift(order);
    writeMeta(meta);
    await pushMeta();
    return order;
  }

  async function setOrderStatus(orderId, status, user) {
    if (!canManage(user)) throw new Error("Solo l’admin può gestire le richieste.");
    if (!["pending", "done", "rejected"].includes(status)) {
      throw new Error("Stato non valido.");
    }
    const meta = readMeta();
    const order = (meta.orders || []).find((o) => o.id === orderId);
    if (!order) throw new Error("Richiesta non trovata.");
    order.status = status;
    order.resolvedAt = new Date().toISOString();
    order.resolvedBy = user.id;
    writeMeta(meta);
    await pushMeta();
    return order;
  }

  function formatPrice(price) {
    try {
      return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(price) || 0);
    } catch {
      return `${Number(price) || 0} €`;
    }
  }

  function availabilityLabel(item) {
    if (!item.available) return "Non disponibile";
    if (item.stockLabel) return item.stockLabel;
    return "Disponibile";
  }

  return {
    TYPES,
    listTypes,
    getItems,
    getItem,
    canManage,
    getImageUrl,
    upsertItem,
    deleteItem,
    getOrders,
    pendingOrdersCount,
    placeOrder,
    setOrderStatus,
    formatPrice,
    availabilityLabel,
    pullRemote,
    pushMeta,
  };
})();
