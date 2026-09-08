/* Canzoniere reparto: metadati localStorage + cloud, PDF IndexedDB + Netlify Blobs. */

const CanzoniereStore = (() => {
  const META_KEY = "firenze1_canzoniere_meta_v1";
  const DB_NAME = "firenze1_canzoniere_db";
  const STORE = "files";
  const MAX_BYTES = 18 * 1024 * 1024; // ~18MB

  function readMeta() {
    try {
      const raw = localStorage.getItem(META_KEY);
      return raw
        ? JSON.parse(raw)
        : { book: null, songs: [], proposals: [] };
    } catch {
      return { book: null, songs: [], proposals: [] };
    }
  }

  function writeMeta(meta) {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  }

  function uid(prefix = "cz") {
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

  async function putFile(id, file) {
    if (!file || file.type !== "application/pdf") {
      throw new Error("Carica un file PDF.");
    }
    if (file.size > MAX_BYTES) {
      throw new Error("PDF troppo grande (max circa 18 MB).");
    }
    const buffer = await file.arrayBuffer();
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        id,
        name: file.name,
        type: file.type,
        size: file.size,
        blob: new Blob([buffer], { type: "application/pdf" }),
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function putBlobRecord(id, blob, name = `${id}.pdf`) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        id,
        name,
        type: "application/pdf",
        size: blob.size,
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

  async function pushMeta() {
    if (typeof CloudSync === "undefined") return;
    await CloudSync.putCanzoniereMeta(readMeta());
  }

  async function syncPdfToCloud(fileId, file) {
    if (typeof CloudSync === "undefined" || !CloudSync.available()) {
      return { ok: false, reason: "cloud-non-disponibile" };
    }
    try {
      await CloudSync.uploadPdf(fileId, file);
      return { ok: true };
    } catch (err) {
      console.warn("[CanzoniereStore] upload cloud", err);
      return { ok: false, reason: err.message || "upload-fallito" };
    }
  }

  async function pushLocalFilesToCloud() {
    if (typeof CloudSync === "undefined" || !CloudSync.available()) return { ok: false };
    const meta = readMeta();
    let ok = true;
    async function one(fileId, fileName) {
      if (!fileId) return;
      const rec = await getFile(fileId);
      if (!rec?.blob) return;
      const file = new File([rec.blob], fileName || `${fileId}.pdf`, { type: "application/pdf" });
      try {
        await CloudSync.uploadPdf(fileId, file);
      } catch (err) {
        console.warn("[CanzoniereStore] reupload", fileId, err);
        ok = false;
      }
    }
    if (meta.book?.fileId) await one(meta.book.fileId, meta.book.fileName);
    for (const song of meta.songs || []) {
      await one(song.fileId, song.fileName || `${song.title}.pdf`);
    }
    await pushMeta();
    return { ok };
  }

  /** Allinea meta dal cloud (telefono/altro browser vedono lo stesso canzoniere). */
  async function pullRemote() {
    if (typeof CloudSync === "undefined") return false;
    const remote = await CloudSync.getCanzoniereMeta();
    if (!remote) return false;
    const hasRemote =
      remote.book ||
      (Array.isArray(remote.songs) && remote.songs.length) ||
      (Array.isArray(remote.proposals) && remote.proposals.length);
    const local = readMeta();
    const hasLocal =
      local.book ||
      (local.songs || []).length ||
      (local.proposals || []).length;

    if (hasRemote) {
      writeMeta({
        book: remote.book || null,
        songs: Array.isArray(remote.songs) ? remote.songs : [],
        proposals: Array.isArray(remote.proposals) ? remote.proposals : [],
      });
      return true;
    }
    if (hasLocal) {
      await pushLocalFilesToCloud();
    }
    return false;
  }

  async function getPdfUrl(fileId) {
    const record = await getFile(fileId);
    if (record?.blob) return URL.createObjectURL(record.blob);

    if (typeof CloudSync !== "undefined" && CloudSync.available()) {
      const res = await fetch(CloudSync.pdfUrl(fileId), { credentials: "omit" });
      if (!res.ok) throw new Error("PDF non trovato sul cloud.");
      const blob = await res.blob();
      await putBlobRecord(fileId, blob).catch(() => {});
      return URL.createObjectURL(blob);
    }
    throw new Error("PDF non trovato.");
  }

  async function openPdf(fileId) {
    const url = await getPdfUrl(fileId);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return url;
  }

  function getBook() {
    return readMeta().book;
  }

  function getSongs() {
    return [...(readMeta().songs || [])].sort((a, b) =>
      a.title.localeCompare(b.title, "it", { sensitivity: "base" })
    );
  }

  function getProposals() {
    return [...(readMeta().proposals || [])].sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || "")
    );
  }

  function pendingProposalsCount() {
    return getProposals().filter((p) => p.status === "pending").length;
  }

  function canManage(user) {
    if (!user) return false;
    if (typeof ScoutStore !== "undefined" && ScoutStore.isAdminUser?.(user)) return true;
    return user.branca === "reparto";
  }

  async function setBook(file, user) {
    if (!canManage(user)) throw new Error("Solo staff reparto (o admin) può aggiornare il canzoniere.");
    const meta = readMeta();
    const oldId = meta.book?.fileId;
    const fileId = uid("book");
    await putFile(fileId, file);
    meta.book = {
      fileId,
      fileName: file.name,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    };
    writeMeta(meta);
    const cloud = await syncPdfToCloud(fileId, file);
    await pushMeta();
    if (oldId) {
      await deleteFile(oldId).catch(() => {});
      if (typeof CloudSync !== "undefined") await CloudSync.deletePdf(oldId);
    }
    return { book: meta.book, cloudOk: cloud.ok };
  }

  async function addSong({ title, file }, user) {
    if (!canManage(user)) throw new Error("Solo staff reparto (o admin) può aggiungere canzoni.");
    const clean = String(title || "").trim();
    if (!clean) throw new Error("Inserisci il titolo della canzone.");
    const fileId = uid("song");
    await putFile(fileId, file);
    const meta = readMeta();
    const song = {
      id: uid("songmeta"),
      title: clean,
      fileId,
      fileName: file.name,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };
    meta.songs = meta.songs || [];
    meta.songs.push(song);
    writeMeta(meta);
    const cloud = await syncPdfToCloud(fileId, file);
    await pushMeta();
    return { song, cloudOk: cloud.ok };
  }

  async function deleteSong(songId, user) {
    if (!canManage(user)) throw new Error("Non autorizzato.");
    const meta = readMeta();
    const song = (meta.songs || []).find((s) => s.id === songId);
    if (!song) return;
    meta.songs = meta.songs.filter((s) => s.id !== songId);
    writeMeta(meta);
    await deleteFile(song.fileId).catch(() => {});
    if (typeof CloudSync !== "undefined") await CloudSync.deletePdf(song.fileId);
    await pushMeta();
  }

  async function proposeSong({ title, notes, fromName }) {
    await pullRemote().catch(() => {});
    const clean = String(title || "").trim();
    if (!clean) throw new Error("Inserisci il titolo della canzone.");
    const meta = readMeta();
    const proposal = {
      id: uid("prop"),
      title: clean,
      notes: String(notes || "").trim(),
      fromName: String(fromName || "").trim() || "Anonimo",
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    meta.proposals = meta.proposals || [];
    meta.proposals.unshift(proposal);
    writeMeta(meta);
    await pushMeta();
    return proposal;
  }

  async function setProposalStatus(id, status, user) {
    if (!canManage(user)) throw new Error("Non autorizzato.");
    if (!["pending", "done", "rejected"].includes(status)) {
      throw new Error("Stato non valido.");
    }
    const meta = readMeta();
    const item = (meta.proposals || []).find((p) => p.id === id);
    if (!item) throw new Error("Proposta non trovata.");
    item.status = status;
    item.resolvedAt = new Date().toISOString();
    item.resolvedBy = user.id;
    writeMeta(meta);
    await pushMeta();
    return item;
  }

  return {
    getBook,
    getSongs,
    getProposals,
    pendingProposalsCount,
    canManage,
    setBook,
    addSong,
    deleteSong,
    proposeSong,
    setProposalStatus,
    openPdf,
    getPdfUrl,
    pullRemote,
    pushMeta,
    pushLocalFilesToCloud,
  };
})();
