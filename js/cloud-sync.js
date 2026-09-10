/* Client sync verso Cloudflare Worker /api/sync (KV). Compatibile anche con Netlify. */

window.CloudSync = (() => {
  const ENDPOINTS = ["/api/sync", "/.netlify/functions/scout-sync"];
  const CHUNK_CHARS = 2_800_000;

  let resolvedBase = null;

  function writeKey() {
    return window.SCOUT_CONFIG?.syncWriteKey || "firenze1-ms-sync";
  }

  function available() {
    return /^https?:$/i.test(location.protocol);
  }

  async function pickBase() {
    if (resolvedBase) return resolvedBase;
    if (!available()) return null;
    for (const base of ENDPOINTS) {
      try {
        const res = await fetch(`${base}?resource=accounts`, { credentials: "omit" });
        // 200 OK, or 503 = API presente ma KV non bindato
        if (res.status === 200 || res.status === 503 || res.status === 403) {
          resolvedBase = base;
          return base;
        }
      } catch {
        /* try next */
      }
    }
    resolvedBase = ENDPOINTS[0];
    return resolvedBase;
  }

  async function getJson(resource, extra = {}) {
    if (!available()) return null;
    const base = await pickBase();
    const qs = new URLSearchParams({ resource, ...extra });
    const res = await fetch(`${base}?${qs}`, { credentials: "omit" });
    if (res.status === 503) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Sync cloud non configurata (KV).");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Sync GET fallita (${res.status})`);
    }
    return res.json();
  }

  async function postJson(payload) {
    if (!available()) return null;
    const base = await pickBase();
    const res = await fetch(base, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Write-Key": writeKey(),
      },
      body: JSON.stringify({ ...payload, writeKey: writeKey() }),
      credentials: "omit",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Sync POST fallita (${res.status})`);
    }
    return res.json();
  }

  async function getAccounts() {
    try {
      return await getJson("accounts");
    } catch {
      return null;
    }
  }

  async function putAccounts(users, pending) {
    try {
      return await postJson({ resource: "accounts", users, pending });
    } catch (err) {
      console.warn("[CloudSync] putAccounts", err);
      return null;
    }
  }

  async function getCanzoniereMeta() {
    try {
      return await getJson("canzoniere-meta");
    } catch {
      return null;
    }
  }

  async function putCanzoniereMeta(meta) {
    try {
      return await postJson({ resource: "canzoniere-meta", meta });
    } catch (err) {
      console.warn("[CloudSync] putCanzoniereMeta", err);
      return null;
    }
  }

  async function getShopMeta() {
    try {
      return await getJson("shop-meta");
    } catch {
      return null;
    }
  }

  async function putShopMeta(meta) {
    try {
      return await postJson({ resource: "shop-meta", meta });
    } catch (err) {
      console.warn("[CloudSync] putShopMeta", err);
      return null;
    }
  }

  async function getNews() {
    try {
      return await getJson("news");
    } catch {
      return null;
    }
  }

  async function putNews(items) {
    try {
      return await postJson({ resource: "news", items });
    } catch (err) {
      console.warn("[CloudSync] putNews", err);
      return null;
    }
  }

  async function getSettings() {
    try {
      return await getJson("settings");
    } catch {
      return null;
    }
  }

  async function putSettings(settings) {
    try {
      return await postJson({ resource: "settings", settings });
    } catch (err) {
      console.warn("[CloudSync] putSettings", err);
      return null;
    }
  }

  async function getSentieroMeta() {
    try {
      return await getJson("sentiero-meta");
    } catch {
      return null;
    }
  }

  async function putSentieroMeta(meta) {
    try {
      return await postJson({ resource: "sentiero-meta", meta });
    } catch (err) {
      console.warn("[CloudSync] putSentieroMeta", err);
      return null;
    }
  }

  async function fileUrl(kind, id) {
    const base = (await pickBase()) || ENDPOINTS[0];
    const resource = kind === "pdf" ? "pdf" : "file";
    const qs = new URLSearchParams({ resource, id: String(id) });
    return `${base}?${qs}`;
  }

  function pdfUrl(id) {
    // sync helper used before pickBase resolves — prefer /api/sync
    const qs = new URLSearchParams({ resource: "pdf", id: String(id) });
    return `${resolvedBase || ENDPOINTS[0]}?${qs}`;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error || new Error("Lettura file fallita"));
      reader.readAsDataURL(file);
    });
  }

  async function uploadBinary(kind, id, file) {
    if (!available()) return false;
    const b64 = await fileToBase64(file);
    const total = Math.max(1, Math.ceil(b64.length / CHUNK_CHARS));
    const resource = kind === "pdf" ? "pdf-chunk" : "file-chunk";
    for (let i = 0; i < total; i++) {
      const slice = b64.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS);
      const result = await postJson({
        resource,
        id,
        fileName: file.name || `${id}.bin`,
        contentType: file.type || (kind === "pdf" ? "application/pdf" : "application/octet-stream"),
        chunkIndex: i,
        chunkTotal: total,
        dataBase64: slice,
      });
      if (!result?.ok) throw new Error("Upload cloud fallito");
    }
    return true;
  }

  async function uploadPdf(id, file) {
    return uploadBinary("pdf", id, file);
  }

  async function uploadFile(id, file) {
    return uploadBinary("file", id, file);
  }

  async function deletePdf(id) {
    try {
      return await postJson({ resource: "pdf-delete", id });
    } catch (err) {
      console.warn("[CloudSync] deletePdf", err);
      return null;
    }
  }

  async function deleteFile(id) {
    try {
      return await postJson({ resource: "file-delete", id });
    } catch (err) {
      console.warn("[CloudSync] deleteFile", err);
      return null;
    }
  }

  return {
    available,
    getAccounts,
    putAccounts,
    getCanzoniereMeta,
    putCanzoniereMeta,
    getShopMeta,
    putShopMeta,
    getNews,
    putNews,
    getSettings,
    putSettings,
    getSentieroMeta,
    putSentieroMeta,
    uploadPdf,
    uploadFile,
    deletePdf,
    deleteFile,
    pdfUrl,
    fileUrl,
  };
})();
