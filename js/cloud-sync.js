/* Client sync verso Netlify Function + Blobs (account staff e canzoniere). */

window.CloudSync = (() => {
  const FN = "/.netlify/functions/scout-sync";
  const CHUNK_CHARS = 2_800_000; // ~2MB base64 per richiesta

  function writeKey() {
    return window.SCOUT_CONFIG?.syncWriteKey || "firenze1-ms-sync";
  }

  function available() {
    return /^https?:$/i.test(location.protocol);
  }

  async function getJson(resource, extra = {}) {
    if (!available()) return null;
    const qs = new URLSearchParams({ resource, ...extra });
    const res = await fetch(`${FN}?${qs}`, { credentials: "omit" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Sync GET fallita (${res.status})`);
    }
    return res.json();
  }

  async function postJson(payload) {
    if (!available()) return null;
    const res = await fetch(FN, {
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

  function pdfUrl(id) {
    const qs = new URLSearchParams({ resource: "pdf", id: String(id) });
    return `${FN}?${qs}`;
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

  async function uploadPdf(id, file) {
    if (!available()) return false;
    const b64 = await fileToBase64(file);
    const total = Math.max(1, Math.ceil(b64.length / CHUNK_CHARS));
    for (let i = 0; i < total; i++) {
      const slice = b64.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS);
      const result = await postJson({
        resource: "pdf-chunk",
        id,
        fileName: file.name || `${id}.pdf`,
        chunkIndex: i,
        chunkTotal: total,
        dataBase64: slice,
      });
      if (!result?.ok) throw new Error("Upload PDF cloud fallito");
    }
    return true;
  }

  async function deletePdf(id) {
    try {
      return await postJson({ resource: "pdf-delete", id });
    } catch (err) {
      console.warn("[CloudSync] deletePdf", err);
      return null;
    }
  }

  return {
    available,
    getAccounts,
    putAccounts,
    getCanzoniereMeta,
    putCanzoniereMeta,
    uploadPdf,
    deletePdf,
    pdfUrl,
  };
})();
