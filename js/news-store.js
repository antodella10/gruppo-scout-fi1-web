/* Notizie gruppo: localStorage + sync cloud; immagini locandina su R2. */

const NewsStore = (() => {
  const KEY = "firenze1_news_v1";
  const DASH_KEY = "firenze1_dash_tiles_v1";

  function uid(prefix = "news") {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }

  function defaults() {
    return [
      {
        id: "news_welcome",
        title: "Benvenuti sul nuovo sito",
        date: "2026-09-01",
        body: "Qui troverete sedi, orari, calendario e le novità del Firenze 1. Restate sintonizzati!",
        createdAt: "2026-09-01T10:00:00.000Z",
      },
      {
        id: "news_avvio",
        title: "Anno scout in avvio",
        date: "2026-09-01",
        body: "Le branche ripartono con le riunioni settimanali. Controlla gli orari in home e il calendario attività.",
        createdAt: "2026-09-01T09:00:00.000Z",
      },
    ];
  }

  function readAll() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        const seed = defaults();
        localStorage.setItem(KEY, JSON.stringify(seed));
        return seed;
      }
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : defaults();
    } catch {
      return defaults();
    }
  }

  function writeAll(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  async function pushRemote() {
    if (typeof CloudSync === "undefined") return;
    await CloudSync.putNews(readAll());
  }

  async function pullRemote() {
    if (typeof CloudSync === "undefined") return false;
    const remote = await CloudSync.getNews();
    if (!remote) return false;
    if (Array.isArray(remote.items) && remote.items.length) {
      writeAll(remote.items);
      return true;
    }
    const local = readAll();
    if (local.length) await CloudSync.putNews(local);
    return false;
  }

  function normalize(item) {
    return {
      id: item.id,
      title: String(item.title || "").trim(),
      date: String(item.date || "").trim(),
      body: String(item.body || "").trim(),
      imageId: item.imageId || null,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || null,
    };
  }

  function getNews() {
    return readAll()
      .map(normalize)
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
  }

  function getLatest() {
    return getNews()[0] || null;
  }

  function getById(id) {
    return getNews().find((n) => n.id === id) || null;
  }

  function canManage(user) {
    return !!(user && typeof ScoutStore !== "undefined" && ScoutStore.isAdminUser?.(user));
  }

  async function upsert(payload, user) {
    if (!canManage(user)) throw new Error("Solo l’admin può gestire le notizie.");
    const title = String(payload.title || "").trim();
    const body = String(payload.body || "").trim();
    const date = String(payload.date || "").trim();
    if (!title) throw new Error("Inserisci un titolo.");
    if (!body) throw new Error("Inserisci il testo della notizia.");
    if (!date) throw new Error("Inserisci la data.");

    const list = readAll();
    let item = payload.id ? list.find((x) => x.id === payload.id) : null;
    const prevImageId = item?.imageId || null;
    if (!item) {
      item = { id: uid("news"), createdAt: new Date().toISOString() };
      list.unshift(item);
    }
    item.title = title;
    item.body = body;
    item.date = date;
    item.updatedAt = new Date().toISOString();

    let nextImageId = prevImageId;
    if (payload.clearImage) {
      nextImageId = null;
    } else if (payload.imageFile instanceof File && payload.imageFile.size) {
      if (typeof GalleryStore === "undefined") {
        throw new Error("Upload immagine non disponibile.");
      }
      nextImageId = await GalleryStore.uploadAttachment(payload.imageFile, user);
    }
    item.imageId = nextImageId || null;

    writeAll(list);
    pushRemote().catch(() => {});

    if (prevImageId && prevImageId !== item.imageId && typeof GalleryStore !== "undefined") {
      GalleryStore.deleteAttachment(prevImageId, user).catch(() => {});
    }
    return normalize(item);
  }

  async function remove(id, user) {
    if (!canManage(user)) throw new Error("Solo l’admin può gestire le notizie.");
    const item = readAll().find((x) => x.id === id);
    writeAll(readAll().filter((x) => x.id !== id));
    pushRemote().catch(() => {});
    if (item?.imageId && typeof GalleryStore !== "undefined") {
      GalleryStore.deleteAttachment(item.imageId, user).catch(() => {});
    }
  }

  function formatDate(isoDate) {
    if (!isoDate) return "";
    try {
      const d = new Date(`${isoDate}T12:00:00`);
      if (Number.isNaN(d.getTime())) return isoDate;
      return d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
    } catch {
      return isoDate;
    }
  }

  function getDashTilePrefs(userId) {
    if (!userId) return null;
    try {
      const all = JSON.parse(localStorage.getItem(DASH_KEY) || "{}");
      const ids = all[userId];
      return Array.isArray(ids) ? ids : null;
    } catch {
      return null;
    }
  }

  function setDashTilePrefs(userId, ids) {
    if (!userId) return;
    const all = (() => {
      try {
        return JSON.parse(localStorage.getItem(DASH_KEY) || "{}");
      } catch {
        return {};
      }
    })();
    if (!ids || !ids.length) delete all[userId];
    else all[userId] = ids;
    localStorage.setItem(DASH_KEY, JSON.stringify(all));
  }

  return {
    getNews,
    getLatest,
    getById,
    canManage,
    upsert,
    remove,
    formatDate,
    getDashTilePrefs,
    setDashTilePrefs,
    pullRemote,
    pushRemote,
  };
})();
