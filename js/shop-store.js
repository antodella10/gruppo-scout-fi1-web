/* Negozio “Magazzino di Kala Nag”: meta in localStorage, immagini in IndexedDB. */

const ShopStore = (() => {
  const META_KEY = "firenze1_shop_meta_v1";
  const DB_NAME = "firenze1_shop_db";
  const STORE = "images";
  const TYPES = ["Abbigliamento", "Accessori", "Materiale", "Libri", "Altro"];

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

  function normalizeItem(raw) {
    return {
      id: raw.id,
      name: String(raw.name || "").trim(),
      price: Number(raw.price) || 0,
      available: raw.available !== false && raw.available !== 0 && raw.available !== "0",
      stockLabel: String(raw.stockLabel || "").trim(),
      type: String(raw.type || "Altro").trim() || "Altro",
      imageId: raw.imageId || null,
      notes: String(raw.notes || "").trim(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
  }

  function listTypes() {
    const fromItems = getItems().map((i) => i.type).filter(Boolean);
    return [...new Set([...TYPES, ...fromItems])].sort((a, b) =>
      a.localeCompare(b, "it", { sensitivity: "base" })
    );
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
    if (!rec?.blob) return null;
    return URL.createObjectURL(rec.blob);
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
    const isNew = !item;
    if (isNew) {
      item = { id: uid("item"), imageId: null };
      meta.items.push(item);
    }

    item.name = name;
    item.price = price;
    item.available = payload.available !== false && payload.available !== "0" && payload.available !== 0;
    item.stockLabel = String(payload.stockLabel || "").trim();
    item.type = String(payload.type || "Altro").trim() || "Altro";
    item.notes = String(payload.notes || "").trim();
    item.updatedAt = new Date().toISOString();

    if (imageFile) {
      const blob = await fileToJpegBlob(imageFile);
      const oldId = item.imageId;
      const imageId = uid("img");
      await putImage(imageId, blob);
      item.imageId = imageId;
      if (oldId) await deleteImage(oldId).catch(() => {});
    }

    writeMeta(meta);
    return normalizeItem(item);
  }

  async function deleteItem(id, user) {
    if (!canManage(user)) throw new Error("Solo l’admin può gestire il negozio.");
    const meta = readMeta();
    const item = (meta.items || []).find((x) => x.id === id);
    if (!item) return;
    meta.items = meta.items.filter((x) => x.id !== id);
    writeMeta(meta);
    if (item.imageId) await deleteImage(item.imageId).catch(() => {});
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

  function orderMailto(item) {
    const email = window.SCOUT_CONFIG?.adminEmail || "scoutfirenze1ms@gmail.com";
    const subject = encodeURIComponent(`Ordine negozio: ${item.name}`);
    const body = encodeURIComponent(
      `Ciao,\nvorrei ordinare per ritiro in sede:\n\n• ${item.name}\n• Prezzo: ${formatPrice(item.price)}\n• Tipologia: ${item.type}\n\nNome e cognome:\nTelefono:\nSede preferita (Girone / Quarate):\n\nGrazie!`
    );
    return `mailto:${email}?subject=${subject}&body=${body}`;
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
    formatPrice,
    availabilityLabel,
    orderMailto,
  };
})();
