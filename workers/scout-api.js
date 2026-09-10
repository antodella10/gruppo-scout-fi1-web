/**
 * Cloudflare Worker: static assets + /api/sync (KV).
 * Sostituisce Netlify Blobs per account, canzoniere, negozio, notizie, settings, file.
 */
const DEFAULT_WRITE_KEY = "firenze1-ms-sync";

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Write-Key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    ...extra,
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders({ "Content-Type": "application/json", ...extraHeaders }),
  });
}

function writeKeyOk(request, body, env) {
  const expected = env.SCOUT_WRITE_KEY || DEFAULT_WRITE_KEY;
  const fromHeader = request.headers.get("X-Write-Key") || "";
  const fromBody = body?.writeKey || "";
  return fromHeader === expected || fromBody === expected;
}

async function kvGetJson(kv, key, fallback) {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function handleSync(request, env) {
  const kv = env.SCOUT_KV;
  if (!kv) {
    return json(
      {
        error:
          "Sync non configurata: aggiungi il binding KV “SCOUT_KV” al Worker (vedi istruzioni).",
      },
      503
    );
  }

  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    if (request.method === "GET") {
      const resource = url.searchParams.get("resource") || "";

      if (resource === "accounts") {
        const data = await kvGetJson(kv, "staff-accounts", {
          users: [],
          pending: [],
          updatedAt: null,
        });
        return json(data);
      }

      if (resource === "canzoniere-meta") {
        const data = await kvGetJson(kv, "canzoniere-meta", {
          book: null,
          songs: [],
          proposals: [],
          updatedAt: null,
        });
        return json(data);
      }

      if (resource === "shop-meta") {
        const data = await kvGetJson(kv, "shop-meta", {
          items: [],
          orders: [],
          updatedAt: null,
        });
        return json(data);
      }

      if (resource === "news") {
        const data = await kvGetJson(kv, "news", { items: null, updatedAt: null });
        return json(data);
      }

      if (resource === "settings") {
        const data = await kvGetJson(kv, "settings", {
          iscrizioniFormUrl: "",
          social: null,
          meetingHours: [],
          googleCalendars: [],
          updatedAt: null,
        });
        return json(data);
      }

      if (resource === "sentiero-meta") {
        const data = await kvGetJson(kv, "sentiero-meta", null);
        return json(data || { libretto: null, specialita: [], updatedAt: null });
      }

      if (resource === "pdf" || resource === "file") {
        const id = String(url.searchParams.get("id") || "").trim();
        if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
          return json({ error: "id non valido" }, 400);
        }
        const prefix = resource === "pdf" ? "pdf" : "file";
        const metaRaw = await kv.get(`${prefix}-meta:${id}`);
        const meta = metaRaw ? JSON.parse(metaRaw) : { contentType: "application/octet-stream", chunks: 0 };
        if (!meta.chunks) {
          // single-blob fallback
          const buf = await kv.get(`${prefix}:${id}`, { type: "arrayBuffer" });
          if (!buf) return json({ error: "file non trovato" }, 404);
          return new Response(buf, {
            status: 200,
            headers: corsHeaders({
              "Content-Type": meta.contentType || "application/octet-stream",
              "Cache-Control": "public, max-age=300",
            }),
          });
        }
        const parts = [];
        for (let i = 0; i < meta.chunks; i++) {
          const part = await kv.get(`${prefix}-chunk:${id}:${i}`);
          if (!part) return json({ error: `manca chunk ${i}` }, 400);
          parts.push(part);
        }
        const binary = Uint8Array.from(atob(parts.join("")), (c) => c.charCodeAt(0));
        return new Response(binary, {
          status: 200,
          headers: corsHeaders({
            "Content-Type": meta.contentType || "application/pdf",
            "Cache-Control": "public, max-age=300",
            "Content-Disposition": `inline; filename="${(meta.fileName || id + ".bin").replace(/"/g, "")}"`,
          }),
        });
      }

      return json({ error: "resource sconosciuta" }, 400);
    }

    if (request.method === "POST") {
      let body = {};
      try {
        body = await request.json();
      } catch {
        return json({ error: "JSON non valido" }, 400);
      }
      if (!writeKeyOk(request, body, env)) {
        return json({ error: "write key non valida" }, 403);
      }

      const resource = body.resource || "";

      if (resource === "accounts") {
        const payload = {
          users: Array.isArray(body.users) ? body.users : [],
          pending: Array.isArray(body.pending) ? body.pending : [],
          updatedAt: new Date().toISOString(),
        };
        await kv.put("staff-accounts", JSON.stringify(payload));
        return json({ ok: true, updatedAt: payload.updatedAt });
      }

      if (resource === "canzoniere-meta") {
        const meta = body.meta || {};
        const payload = {
          book: meta.book || null,
          songs: Array.isArray(meta.songs) ? meta.songs : [],
          proposals: Array.isArray(meta.proposals) ? meta.proposals : [],
          updatedAt: new Date().toISOString(),
        };
        await kv.put("canzoniere-meta", JSON.stringify(payload));
        return json({ ok: true, updatedAt: payload.updatedAt });
      }

      if (resource === "shop-meta") {
        const meta = body.meta || {};
        const payload = {
          items: Array.isArray(meta.items) ? meta.items : [],
          orders: Array.isArray(meta.orders) ? meta.orders : [],
          updatedAt: new Date().toISOString(),
        };
        await kv.put("shop-meta", JSON.stringify(payload));
        return json({ ok: true, updatedAt: payload.updatedAt });
      }

      if (resource === "news") {
        const payload = {
          items: Array.isArray(body.items) ? body.items : [],
          updatedAt: new Date().toISOString(),
        };
        await kv.put("news", JSON.stringify(payload));
        return json({ ok: true, updatedAt: payload.updatedAt });
      }

      if (resource === "settings") {
        const s = body.settings || {};
        const payload = {
          iscrizioniFormUrl: String(s.iscrizioniFormUrl || "").trim(),
          social: s.social && typeof s.social === "object" ? s.social : null,
          meetingHours: Array.isArray(s.meetingHours) ? s.meetingHours : [],
          googleCalendars: Array.isArray(s.googleCalendars) ? s.googleCalendars : [],
          updatedAt: new Date().toISOString(),
        };
        await kv.put("settings", JSON.stringify(payload));
        return json({ ok: true, updatedAt: payload.updatedAt });
      }

      if (resource === "sentiero-meta") {
        const meta = body.meta || {};
        const payload = {
          libretto: meta.libretto || null,
          specialita: Array.isArray(meta.specialita) ? meta.specialita : [],
          updatedAt: new Date().toISOString(),
        };
        await kv.put("sentiero-meta", JSON.stringify(payload));
        return json({ ok: true, updatedAt: payload.updatedAt });
      }

      if (resource === "pdf-chunk" || resource === "file-chunk") {
        const prefix = resource === "pdf-chunk" ? "pdf" : "file";
        const id = String(body.id || "").trim();
        const index = Number(body.chunkIndex);
        const total = Number(body.chunkTotal);
        if (!id || !/^[a-zA-Z0-9_-]+$/.test(id) || !Number.isFinite(index) || !Number.isFinite(total)) {
          return json({ error: "chunk non valido" }, 400);
        }
        if (total < 1 || total > 40 || index < 0 || index >= total) {
          return json({ error: "indici chunk non validi" }, 400);
        }
        const data = String(body.dataBase64 || "");
        if (!data || data.length > 5_500_000) {
          return json({ error: "chunk troppo grande" }, 400);
        }
        await kv.put(`${prefix}-chunk:${id}:${index}`, data);
        if (index < total - 1) {
          return json({ ok: true, stored: index });
        }
        // verify all chunks present
        for (let i = 0; i < total; i++) {
          const part = await kv.get(`${prefix}-chunk:${id}:${i}`);
          if (!part) return json({ error: `manca chunk ${i}` }, 400);
        }
        const contentType =
          String(body.contentType || (prefix === "pdf" ? "application/pdf" : "application/octet-stream")).slice(0, 120);
        const fileName = String(body.fileName || `${id}.bin`).slice(0, 180);
        await kv.put(
          `${prefix}-meta:${id}`,
          JSON.stringify({
            chunks: total,
            contentType,
            fileName,
            updatedAt: new Date().toISOString(),
          })
        );
        return json({ ok: true, id, chunks: total });
      }

      if (resource === "pdf-delete" || resource === "file-delete") {
        const prefix = resource === "pdf-delete" ? "pdf" : "file";
        const id = String(body.id || "").trim();
        if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
          return json({ error: "id non valido" }, 400);
        }
        const metaRaw = await kv.get(`${prefix}-meta:${id}`);
        const meta = metaRaw ? JSON.parse(metaRaw) : null;
        if (meta?.chunks) {
          for (let i = 0; i < meta.chunks; i++) {
            await kv.delete(`${prefix}-chunk:${id}:${i}`);
          }
        }
        await kv.delete(`${prefix}-meta:${id}`);
        await kv.delete(`${prefix}:${id}`);
        return json({ ok: true });
      }

      return json({ error: "resource sconosciuta" }, 400);
    }

    return json({ error: "method not allowed" }, 405);
  } catch (err) {
    return json({ error: err.message || "Errore server" }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/sync" || url.pathname.startsWith("/api/sync/")) {
      return handleSync(request, env);
    }
    // Static site
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Assets binding missing", { status: 500 });
  },
};
