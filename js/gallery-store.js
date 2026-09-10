/* Galleria foto pubblica: meta + file su Cloudflare R2 via /api/gallery. */
window.GalleryStore = (() => {
  let cache = { items: [], at: 0 };
  const CACHE_MS = 30_000;

  function canManage(user) {
    return typeof ScoutStore !== "undefined" && ScoutStore.isAdminUser?.(user);
  }

  function uid() {
    return `gal_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }

  function imageUrl(id) {
    if (typeof CloudSync !== "undefined" && CloudSync.galleryImageUrl) {
      return CloudSync.galleryImageUrl(id);
    }
    return `/api/gallery/file?id=${encodeURIComponent(id)}`;
  }

  async function listItems({ force = false } = {}) {
    if (!force && cache.items.length && Date.now() - cache.at < CACHE_MS) {
      return cache.items;
    }
    if (typeof CloudSync === "undefined") return cache.items;
    const data = await CloudSync.galleryGet();
    const items = Array.isArray(data?.items) ? data.items : [];
    cache = { items, at: Date.now() };
    return items;
  }

  async function fileToJpegBlob(file, maxSide = 1600, quality = 0.82) {
    if (!file || !String(file.type || "").startsWith("image/")) {
      throw new Error("Seleziona un’immagine.");
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
    if (!blob) throw new Error("Compressione immagine fallita.");
    return blob;
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error || new Error("Lettura fallita"));
      reader.readAsDataURL(blob);
    });
  }

  async function upload({ file, title, caption }, user) {
    if (!canManage(user)) throw new Error("Solo l’admin può caricare foto in galleria.");
    if (typeof CloudSync === "undefined" || !CloudSync.available()) {
      throw new Error("Galleria disponibile solo sul sito online (Cloudflare).");
    }
    const jpeg = await fileToJpegBlob(file);
    if (jpeg.size > 2_400_000) {
      throw new Error("Immagine ancora troppo grande dopo compressione. Prova una foto più leggera.");
    }
    const id = uid();
    const dataBase64 = await blobToBase64(jpeg);
    const result = await CloudSync.galleryPost({
      resource: "upload",
      id,
      title: String(title || "").trim() || file.name.replace(/\.[^.]+$/, ""),
      caption: String(caption || "").trim(),
      contentType: "image/jpeg",
      dataBase64,
    });
    cache = { items: [], at: 0 };
    return result?.item || null;
  }

  async function remove(id, user) {
    if (!canManage(user)) throw new Error("Solo l’admin può eliminare foto.");
    await CloudSync.galleryPost({ resource: "delete", id });
    cache = { items: [], at: 0 };
  }

  async function updateMeta(id, { title, caption }, user) {
    if (!canManage(user)) throw new Error("Solo l’admin può modificare la galleria.");
    const result = await CloudSync.galleryPost({
      resource: "update",
      id,
      title,
      caption,
    });
    cache = { items: [], at: 0 };
    return result?.item || null;
  }

  return { canManage, listItems, imageUrl, upload, remove, updateMeta };
})();
