/**
 * Sync account staff + canzoniere (meta e PDF) via Netlify Blobs.
 * GET  ?resource=accounts|canzoniere-meta|pdf&id=
 * POST JSON { resource, writeKey, ... }
 */
const { getStore } = require("@netlify/blobs");

const DEFAULT_WRITE_KEY = "firenze1-ms-sync";
const STORE_NAME = "firenze1-sync";

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Write-Key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    ...extra,
  };
}

function writeKeyOk(event, body) {
  const expected = process.env.SCOUT_WRITE_KEY || DEFAULT_WRITE_KEY;
  const fromHeader = event.headers?.["x-write-key"] || event.headers?.["X-Write-Key"] || "";
  const fromBody = body?.writeKey || "";
  return fromHeader === expected || fromBody === expected;
}

function getSyncStore() {
  return getStore(STORE_NAME);
}

exports.handler = async (event) => {
  const headers = corsHeaders({ "Content-Type": "application/json" });

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders() };
  }

  try {
    const store = getSyncStore();
    const params = event.queryStringParameters || {};

    if (event.httpMethod === "GET") {
      const resource = params.resource || "";

      if (resource === "accounts") {
        const raw = await store.get("staff-accounts", { type: "text" });
        const data = raw ? JSON.parse(raw) : { users: [], pending: [], updatedAt: null };
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      }

      if (resource === "canzoniere-meta") {
        const raw = await store.get("canzoniere-meta", { type: "text" });
        const data = raw
          ? JSON.parse(raw)
          : { book: null, songs: [], proposals: [], updatedAt: null };
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      }

      if (resource === "pdf") {
        const id = String(params.id || "").trim();
        if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: "id non valido" }) };
        }
        const buf = await store.get(`pdf:${id}`, { type: "arrayBuffer" });
        if (!buf) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: "PDF non trovato" }) };
        }
        return {
          statusCode: 200,
          headers: corsHeaders({
            "Content-Type": "application/pdf",
            "Cache-Control": "public, max-age=300",
            "Content-Disposition": `inline; filename="${id}.pdf"`,
          }),
          body: Buffer.from(buf).toString("base64"),
          isBase64Encoded: true,
        };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: "resource sconosciuta" }) };
    }

    if (event.httpMethod === "POST") {
      let body = {};
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "JSON non valido" }) };
      }

      if (!writeKeyOk(event, body)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: "write key non valida" }) };
      }

      const resource = body.resource || "";

      if (resource === "accounts") {
        const payload = {
          users: Array.isArray(body.users) ? body.users : [],
          pending: Array.isArray(body.pending) ? body.pending : [],
          updatedAt: new Date().toISOString(),
        };
        await store.set("staff-accounts", JSON.stringify(payload), {
          metadata: { contentType: "application/json" },
        });
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, updatedAt: payload.updatedAt }) };
      }

      if (resource === "canzoniere-meta") {
        const meta = body.meta || {};
        const payload = {
          book: meta.book || null,
          songs: Array.isArray(meta.songs) ? meta.songs : [],
          proposals: Array.isArray(meta.proposals) ? meta.proposals : [],
          updatedAt: new Date().toISOString(),
        };
        await store.set("canzoniere-meta", JSON.stringify(payload), {
          metadata: { contentType: "application/json" },
        });
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, updatedAt: payload.updatedAt }) };
      }

      if (resource === "pdf-chunk") {
        const id = String(body.id || "").trim();
        const index = Number(body.chunkIndex);
        const total = Number(body.chunkTotal);
        if (!id || !/^[a-zA-Z0-9_-]+$/.test(id) || !Number.isFinite(index) || !Number.isFinite(total)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: "chunk non valido" }) };
        }
        if (total < 1 || total > 40 || index < 0 || index >= total) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: "indici chunk non validi" }) };
        }
        const data = String(body.dataBase64 || "");
        if (!data || data.length > 5_500_000) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: "chunk troppo grande" }) };
        }
        await store.set(`pdf-chunk:${id}:${index}`, data, {
          metadata: { contentType: "text/plain" },
        });

        if (index < total - 1) {
          return { statusCode: 200, headers, body: JSON.stringify({ ok: true, stored: index }) };
        }

        const parts = [];
        for (let i = 0; i < total; i++) {
          const part = await store.get(`pdf-chunk:${id}:${i}`, { type: "text" });
          if (!part) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: `manca chunk ${i}` }),
            };
          }
          parts.push(part);
          await store.delete(`pdf-chunk:${id}:${i}`).catch(() => {});
        }
        const buffer = Buffer.from(parts.join(""), "base64");
        if (buffer.length > 20 * 1024 * 1024) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: "PDF troppo grande" }) };
        }
        await store.set(`pdf:${id}`, buffer, {
          metadata: {
            contentType: "application/pdf",
            fileName: String(body.fileName || `${id}.pdf`).slice(0, 180),
          },
        });
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ ok: true, id, bytes: buffer.length }),
        };
      }

      if (resource === "pdf-delete") {
        const id = String(body.id || "").trim();
        if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: "id non valido" }) };
        }
        await store.delete(`pdf:${id}`).catch(() => {});
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: "resource sconosciuta" }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || "Errore server" }),
    };
  }
};
