/* Sentiero: libretto + specialità. Seed da manifest.json, override in localStorage + IndexedDB. */

const SentieroStore = (() => {
  const META_KEY = "firenze1_sentiero_meta_v1";
  const DB_NAME = "firenze1_sentiero_db";
  const STORE = "files";

  let seedCache = null;

  function uid(prefix = "sen") {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }

  function readMeta() {
    try {
      const raw = localStorage.getItem(META_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeMeta(meta) {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  }

  async function pushMeta() {
    if (typeof CloudSync === "undefined") return;
    const meta = readMeta();
    if (!meta) return;
    await CloudSync.putSentieroMeta(meta);
  }

  async function pullRemoteMeta() {
    if (typeof CloudSync === "undefined") return false;
    const remote = await CloudSync.getSentieroMeta();
    if (!remote) return false;
    const has =
      remote.libretto ||
      (Array.isArray(remote.specialita) && remote.specialita.some((s) => s.source === "upload" || s.fileId));
    // Prefer cloud overrides when present; otherwise keep seed/local
    if (remote.libretto || (Array.isArray(remote.specialita) && remote.specialita.length && remote.updatedAt)) {
      // Only overwrite if remote looks like a managed catalog (has updatedAt from our API)
      if (remote.updatedAt) {
        writeMeta({
          libretto: remote.libretto || null,
          specialita: Array.isArray(remote.specialita) ? remote.specialita : [],
          updatedAt: remote.updatedAt,
        });
        return true;
      }
    }
    if (has) {
      writeMeta({
        libretto: remote.libretto || null,
        specialita: Array.isArray(remote.specialita) ? remote.specialita : [],
        updatedAt: remote.updatedAt || new Date().toISOString(),
      });
      return true;
    }
    return false;
  }

  async function loadSeed() {
    if (seedCache) return seedCache;
    const candidates = [];
    if (window.location.pathname.includes("/staff/")) {
      candidates.push("../sentiero/manifest.json");
    } else if (window.location.pathname.includes("/sentiero")) {
      candidates.push("./manifest.json");
    } else {
      candidates.push("sentiero/manifest.json", "./sentiero/manifest.json");
    }
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        seedCache = await res.json();
        return seedCache;
      } catch {
        /* try next */
      }
    }
    seedCache = { libretto: null, specialita: [] };
    return seedCache;
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

  async function putFile(id, file) {
    const buffer = await file.arrayBuffer();
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        id,
        name: file.name,
        type: file.type || "application/pdf",
        blob: new Blob([buffer], { type: file.type || "application/pdf" }),
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function putImageBlob(id, blob) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        id,
        name: `${id}.png`,
        type: blob.type || "image/png",
        blob,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getFile(id) {
    if (!id) return null;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteFile(id) {
    if (!id) return;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function assetUrl(rel) {
    if (!rel) return "";
    if (/^https?:\/\//i.test(rel) || rel.startsWith("blob:")) return rel;
    // pages under /sentiero/ or /staff/
    if (window.location.pathname.includes("/staff/")) return `../sentiero/${rel.replace(/^\.\//, "")}`;
    if (window.location.pathname.includes("/sentiero")) return `./${rel.replace(/^\.\//, "")}`;
    return `sentiero/${rel.replace(/^\.\//, "")}`;
  }

  async function ensureMeta() {
    await pullRemoteMeta().catch(() => {});
    let meta = readMeta();
    if (meta?.specialita?.length) return meta;
    const seed = await loadSeed();
    meta = {
      libretto: seed.libretto
        ? { ...seed.libretto, source: "static" }
        : null,
      specialita: (seed.specialita || []).map((s) => ({
        id: s.id,
        name: s.name,
        pdfPath: s.pdf,
        imagePath: s.image,
        source: "static",
        fileId: null,
        imageId: null,
      })),
      updatedAt: new Date().toISOString(),
    };
    writeMeta(meta);
    return meta;
  }

  async function getLibretto() {
    const meta = await ensureMeta();
    return meta.libretto || null;
  }

  async function getSpecialita() {
    const meta = await ensureMeta();
    return [...(meta.specialita || [])].sort((a, b) =>
      a.name.localeCompare(b.name, "it", { sensitivity: "base" })
    );
  }

  function canManage(user) {
    if (!user) return false;
    if (typeof ScoutStore !== "undefined" && ScoutStore.isAdminUser?.(user)) return true;
    return user.branca === "reparto";
  }

  async function resolvePdfUrl(item) {
    if (!item) throw new Error("Elemento non trovato.");
    if (item.fileId) {
      const rec = await getFile(item.fileId);
      if (rec?.blob) return URL.createObjectURL(rec.blob);
      if (typeof CloudSync !== "undefined" && CloudSync.available()) {
        return CloudSync.fileUrl("pdf", item.fileId);
      }
      throw new Error("PDF non trovato.");
    }
    if (item.pdfPath) return assetUrl(item.pdfPath);
    throw new Error("PDF non disponibile.");
  }

  async function resolveImageUrl(item) {
    if (!item) return "";
    if (item.imageId) {
      const rec = await getFile(item.imageId);
      if (rec?.blob) return URL.createObjectURL(rec.blob);
      if (typeof CloudSync !== "undefined" && CloudSync.available()) {
        try {
          const url = await CloudSync.fileUrl("file", item.imageId);
          const res = await fetch(url, { credentials: "omit" });
          if (res.ok) {
            const blob = await res.blob();
            await putImageBlob(item.imageId, blob).catch(() => {});
            return URL.createObjectURL(blob);
          }
        } catch {
          /* fall through */
        }
      }
    }
    if (item.imagePath) return assetUrl(item.imagePath);
    return "";
  }

  async function openPdf(item) {
    const url = await resolvePdfUrl(item);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (url.startsWith("blob:")) window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return url;
  }

  async function setLibretto(file, user) {
    if (!canManage(user)) throw new Error("Non autorizzato.");
    if (!file || file.type !== "application/pdf") throw new Error("Carica un PDF.");
    const meta = await ensureMeta();
    const oldId = meta.libretto?.fileId;
    const fileId = uid("lib");
    await putFile(fileId, file);
    meta.libretto = {
      fileId,
      fileName: file.name,
      source: "upload",
      pdfPath: null,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    };
    writeMeta(meta);
    if (typeof CloudSync !== "undefined") {
      await CloudSync.uploadPdf(fileId, file).catch((err) => console.warn(err));
      if (oldId) await CloudSync.deletePdf(oldId);
    }
    await pushMeta();
    if (oldId) await deleteFile(oldId).catch(() => {});
    return meta.libretto;
  }

  async function clearLibretto(user) {
    if (!canManage(user)) throw new Error("Non autorizzato.");
    const meta = await ensureMeta();
    if (meta.libretto?.fileId) {
      await deleteFile(meta.libretto.fileId).catch(() => {});
      if (typeof CloudSync !== "undefined") await CloudSync.deletePdf(meta.libretto.fileId);
    }
    meta.libretto = null;
    writeMeta(meta);
    await pushMeta();
  }

  async function upsertSpecialita(payload, user, { pdfFile, imageFile } = {}) {
    if (!canManage(user)) throw new Error("Non autorizzato.");
    const name = String(payload.name || "").trim();
    if (!name) throw new Error("Inserisci il nome della specialità.");
    const meta = await ensureMeta();
    meta.specialita = meta.specialita || [];
    let item = payload.id ? meta.specialita.find((x) => x.id === payload.id) : null;
    if (!item) {
      item = {
        id: uid("spec"),
        source: "upload",
        pdfPath: null,
        imagePath: null,
        fileId: null,
        imageId: null,
      };
      meta.specialita.push(item);
    }
    item.name = name;
    item.updatedAt = new Date().toISOString();

    if (pdfFile) {
      if (pdfFile.type !== "application/pdf") throw new Error("Il file specialità deve essere un PDF.");
      const old = item.fileId;
      item.fileId = uid("spdf");
      await putFile(item.fileId, pdfFile);
      item.source = "upload";
      item.pdfPath = null;
      if (typeof CloudSync !== "undefined") {
        await CloudSync.uploadPdf(item.fileId, pdfFile).catch((err) => console.warn(err));
        if (old) await CloudSync.deletePdf(old);
      }
      if (old) await deleteFile(old).catch(() => {});
    }
    if (imageFile) {
      if (!imageFile.type.startsWith("image/")) throw new Error("Carica un’immagine per il distintivo.");
      const old = item.imageId;
      item.imageId = uid("simg");
      await putImageBlob(item.imageId, imageFile);
      item.imagePath = null;
      if (typeof CloudSync !== "undefined") {
        await CloudSync.uploadFile(item.imageId, imageFile).catch((err) => console.warn(err));
        if (old) await CloudSync.deleteFile(old);
      }
      if (old) await deleteFile(old).catch(() => {});
    }
    if (!item.fileId && !item.pdfPath) {
      throw new Error("Serve un PDF per la specialità.");
    }
    writeMeta(meta);
    await pushMeta();
    return item;
  }

  async function deleteSpecialita(id, user) {
    if (!canManage(user)) throw new Error("Non autorizzato.");
    const meta = await ensureMeta();
    const item = (meta.specialita || []).find((x) => x.id === id);
    if (!item) return;
    meta.specialita = meta.specialita.filter((x) => x.id !== id);
    writeMeta(meta);
    if (item.fileId) {
      await deleteFile(item.fileId).catch(() => {});
      if (typeof CloudSync !== "undefined") await CloudSync.deletePdf(item.fileId);
    }
    if (item.imageId) {
      await deleteFile(item.imageId).catch(() => {});
      if (typeof CloudSync !== "undefined") await CloudSync.deleteFile(item.imageId);
    }
    await pushMeta();
  }

  async function resetToSeed(user) {
    if (!canManage(user)) throw new Error("Non autorizzato.");
    localStorage.removeItem(META_KEY);
    seedCache = null;
    const meta = await ensureMeta();
    await pushMeta();
    return meta;
  }

  return {
    ensureMeta,
    getLibretto,
    getSpecialita,
    canManage,
    resolvePdfUrl,
    resolveImageUrl,
    openPdf,
    setLibretto,
    clearLibretto,
    upsertSpecialita,
    deleteSpecialita,
    resetToSeed,
  };
})();
