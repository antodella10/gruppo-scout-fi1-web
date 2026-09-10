/* Galleria foto: R2 + meta (branca, featured, cartelle staff). */
window.GalleryStore = (() => {
  let cache = { items: [], folders: [], at: 0 };
  const CACHE_MS = 20_000;
  const FEATURED_MAX = 15;
  const BRANCHES = [
    { id: "gruppo", label: "Gruppo" },
    { id: "branco", label: "Branco" },
    { id: "reparto", label: "Reparto" },
    { id: "noviziato", label: "Noviziato" },
    { id: "clan", label: "Clan" },
  ];

  function canManage(user) {
    return !!(user && typeof ScoutStore !== "undefined" && ScoutStore.getCurrentUser?.());
  }

  function branchLabel(id) {
    return BRANCHES.find((b) => b.id === id)?.label || id || "Gruppo";
  }

  function uid(prefix = "gal") {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }

  function imageUrl(id) {
    if (typeof CloudSync !== "undefined" && CloudSync.galleryImageUrl) {
      return CloudSync.galleryImageUrl(id);
    }
    return `/api/gallery/file?id=${encodeURIComponent(id)}`;
  }

  function applyCache(data) {
    cache = {
      items: Array.isArray(data?.items) ? data.items : [],
      folders: Array.isArray(data?.folders) ? data.folders : [],
      at: Date.now(),
    };
    return cache;
  }

  async function pull({ force = false } = {}) {
    if (!force && cache.at && Date.now() - cache.at < CACHE_MS) return cache;
    if (typeof CloudSync === "undefined") return cache;
    const data = await CloudSync.galleryGet();
    return applyCache(data);
  }

  async function listItems(opts) {
    const data = await pull(opts);
    return data.items;
  }

  async function listFolders(opts) {
    const data = await pull(opts);
    return data.folders;
  }

  function featuredItems(items) {
    return [...(items || [])]
      .filter((i) => i.featured)
      .sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, FEATURED_MAX);
  }

  function byBranca(items, branca) {
    if (!branca || branca === "tutte") return items;
    return (items || []).filter((i) => i.branca === branca);
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

  async function upload({ file, title, caption, branca, folderId }, user) {
    if (!canManage(user)) throw new Error("Devi essere loggato come staff.");
    if (typeof CloudSync === "undefined" || !CloudSync.available()) {
      throw new Error("Galleria disponibile solo sul sito online (Cloudflare).");
    }
    if (!BRANCHES.some((b) => b.id === branca)) {
      throw new Error("Seleziona la branca (o Gruppo).");
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
      title: String(title || "").trim(),
      caption: String(caption || "").trim(),
      branca,
      folderId: folderId || null,
      contentType: "image/jpeg",
      dataBase64,
    });
    applyCache(result);
    return result?.item || null;
  }

  async function uploadMany({ files, title, caption, branca, folderId }, user, onProgress) {
    if (!canManage(user)) throw new Error("Devi essere loggato come staff.");
    const list = [...(files || [])].filter((f) => f && String(f.type || "").startsWith("image/"));
    if (!list.length) throw new Error("Seleziona almeno un’immagine.");
    const ok = [];
    const errors = [];
    for (let i = 0; i < list.length; i++) {
      onProgress?.(i + 1, list.length, list[i].name);
      try {
        const item = await upload(
          { file: list[i], title, caption, branca, folderId },
          user
        );
        ok.push(item);
      } catch (err) {
        errors.push({ name: list[i].name, message: err?.message || "Errore" });
      }
    }
    return { ok, errors, total: list.length };
  }

  async function remove(id, user) {
    if (!canManage(user)) throw new Error("Devi essere loggato come staff.");
    const result = await CloudSync.galleryPost({ resource: "delete", id });
    applyCache(result);
  }

  async function updateMeta(id, patch, user) {
    if (!canManage(user)) throw new Error("Devi essere loggato come staff.");
    const result = await CloudSync.galleryPost({ resource: "update", id, ...patch });
    applyCache(result);
    return result?.item || null;
  }

  async function setFeatured(ids, user) {
    if (!canManage(user)) throw new Error("Devi essere loggato come staff.");
    const clean = [...new Set((ids || []).map(String))].slice(0, FEATURED_MAX);
    const result = await CloudSync.galleryPost({ resource: "set-featured", ids: clean });
    applyCache(result);
    return featuredItems(cache.items);
  }

  async function createFolder(name, user) {
    if (!canManage(user)) throw new Error("Devi essere loggato come staff.");
    const result = await CloudSync.galleryPost({ resource: "folder-create", name });
    applyCache(result);
    return result?.folder || null;
  }

  async function renameFolder(id, name, user) {
    if (!canManage(user)) throw new Error("Devi essere loggato come staff.");
    const result = await CloudSync.galleryPost({ resource: "folder-rename", id, name });
    applyCache(result);
    return result?.folder || null;
  }

  async function deleteFolder(id, user) {
    if (!canManage(user)) throw new Error("Devi essere loggato come staff.");
    const result = await CloudSync.galleryPost({ resource: "folder-delete", id });
    applyCache(result);
  }

  return {
    FEATURED_MAX,
    BRANCHES,
    canManage,
    branchLabel,
    imageUrl,
    pull,
    listItems,
    listFolders,
    featuredItems,
    byBranca,
    upload,
    uploadMany,
    remove,
    updateMeta,
    setFeatured,
    createFolder,
    renameFolder,
    deleteFolder,
  };
})();
