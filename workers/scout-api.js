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
    headers: corsHeaders({
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...extraHeaders,
    }),
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

/* —— Google Calendar ICS proxy (no KV needed) —— */
function unfoldIcs(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "");
}

function icsField(block, name) {
  const re = new RegExp(`(?:^|\\n)${name}(?:;[^:\\n]*)?:([^\\n]*)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

function icsFieldRaw(block, name) {
  const re = new RegExp(`(?:^|\\n)(${name}(?:;[^:\\n]*)?:[^\\n]*)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

function unescapeIcs(value) {
  return String(value || "")
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcsDate(line) {
  if (!line) return null;
  const isDateOnly = /VALUE=DATE/i.test(line) || /:(\d{8})$/.test(line);
  const value = line.split(":").pop().trim();
  if (/^\d{8}$/.test(value)) {
    return {
      allDay: true,
      date: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
      time: "",
    };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;
  let dateObj;
  if (m[7] === "Z") {
    dateObj = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  } else {
    dateObj = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  }
  const y = dateObj.getFullYear();
  const mo = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  const hh = String(dateObj.getHours()).padStart(2, "0");
  const mm = String(dateObj.getMinutes()).padStart(2, "0");
  return {
    allDay: !!isDateOnly && false,
    date: `${y}-${mo}-${d}`,
    time: `${hh}:${mm}`,
  };
}

function addDaysYmd(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function parseIcsEvents(icsText) {
  const text = unfoldIcs(icsText);
  const chunks = text.split(/BEGIN:VEVENT/i);
  const events = [];

  for (let i = 1; i < chunks.length; i++) {
    const block = chunks[i].split(/END:VEVENT/i)[0];
    const startLine = icsFieldRaw(block, "DTSTART");
    const endLine = icsFieldRaw(block, "DTEND");
    const start = parseIcsDate(startLine);
    if (!start) continue;

    const allDay =
      /VALUE=DATE/i.test(startLine) || /^\d{8}$/.test((startLine.split(":").pop() || "").trim());
    let end = parseIcsDate(endLine) || { ...start };
    let dateEnd = end.date;
    if (allDay && dateEnd && dateEnd > start.date) {
      dateEnd = addDaysYmd(dateEnd, -1);
    }
    if (!dateEnd || dateEnd < start.date) dateEnd = start.date;

    events.push({
      uid: icsField(block, "UID") || `ics_${i}`,
      title: unescapeIcs(icsField(block, "SUMMARY")) || "Evento Google",
      description: unescapeIcs(icsField(block, "DESCRIPTION")),
      place: unescapeIcs(icsField(block, "LOCATION")),
      dateStart: start.date,
      dateEnd,
      allDay: !!allDay,
      time: allDay ? "" : start.time || "",
      color: normalizeIcsColor(
        icsField(block, "COLOR") ||
          icsField(block, "X-APPLE-CALENDAR-COLOR") ||
          icsField(block, "X-GOOGLE-CALENDAR-COLOR")
      ),
      colorId: icsField(block, "COLOR") || "",
    });
  }
  return events;
}

function normalizeIcsColor(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  const map = {
    1: "#a4bdfc",
    2: "#7ae7bf",
    3: "#dbadff",
    4: "#ff887c",
    5: "#fbd75b",
    6: "#ffb878",
    7: "#46d6db",
    8: "#e1e1e1",
    9: "#5484ed",
    10: "#51b749",
    11: "#dc2127",
  };
  if (map[v]) return map[v];
  if (/^#?[0-9a-f]{3,8}$/i.test(v)) return v.startsWith("#") ? v : `#${v}`;
  return "";
}

async function handleGcal(request, env = {}) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "GET") {
    return json({ error: "method not allowed" }, 405);
  }

  try {
    const url = new URL(request.url);
    const calendarId = String(url.searchParams.get("id") || "").trim();
    if (!calendarId) {
      return json({ error: "id calendario mancante" }, 400);
    }

    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const apiKey = env.GOOGLE_CALENDAR_API_KEY || env.SCOUT_GCAL_API_KEY || "";

    // Con API key Google possiamo leggere anche i colori evento
    if (apiKey) {
      try {
        const params = new URLSearchParams({
          key: apiKey,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "250",
        });
        if (from) params.set("timeMin", `${from}T00:00:00Z`);
        if (to) params.set("timeMax", `${to}T23:59:59Z`);
        const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
        const apiRes = await fetch(apiUrl);
        if (apiRes.ok) {
          const data = await apiRes.json();
          const colorMap = {
            1: "#a4bdfc",
            2: "#7ae7bf",
            3: "#dbadff",
            4: "#ff887c",
            5: "#fbd75b",
            6: "#ffb878",
            7: "#46d6db",
            8: "#e1e1e1",
            9: "#5484ed",
            10: "#51b749",
            11: "#dc2127",
          };
          let events = (data.items || []).map((item) => {
            const start = item.start || {};
            const end = item.end || {};
            const allDay = !!start.date;
            let dateStart = start.date || String(start.dateTime || "").slice(0, 10);
            let dateEnd = end.date || String(end.dateTime || "").slice(0, 10) || dateStart;
            if (allDay && dateEnd && dateEnd > dateStart) {
              dateEnd = addDaysYmd(dateEnd, -1);
            }
            let time = "";
            if (!allDay && start.dateTime) {
              const dt = new Date(start.dateTime);
              time = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
            }
            return {
              uid: item.id,
              title: item.summary || "Evento Google",
              description: item.description || "",
              place: item.location || "",
              dateStart,
              dateEnd: dateEnd || dateStart,
              allDay,
              time: allDay ? "" : time,
              colorId: item.colorId || "",
              color: item.colorId && colorMap[item.colorId] ? colorMap[item.colorId] : "",
            };
          });
          events.sort(
            (a, b) => a.dateStart.localeCompare(b.dateStart) || (a.time || "").localeCompare(b.time || "")
          );
          return json({ events }, 200, { "Cache-Control": "public, max-age=120" });
        }
      } catch (err) {
        console.warn("[gcal] api fallback to ics", err);
      }
    }

    const icsUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
    const res = await fetch(icsUrl, {
      headers: { "User-Agent": "Firenze1ScoutSite/1.0" },
    });

    if (!res.ok) {
      return json(
        {
          error:
            "Calendario Google non raggiungibile. Rendi il calendario pubblico (Impostazioni → Accessibilità → Rendi disponibile al pubblico).",
          status: res.status,
        },
        502
      );
    }

    const ics = await res.text();
    let events = parseIcsEvents(ics);

    if (from) events = events.filter((e) => (e.dateEnd || e.dateStart) >= from);
    if (to) events = events.filter((e) => e.dateStart <= to);

    events.sort(
      (a, b) => a.dateStart.localeCompare(b.dateStart) || (a.time || "").localeCompare(b.time || "")
    );

    return json({ events }, 200, { "Cache-Control": "public, max-age=120" });
  } catch (err) {
    return json({ error: err.message || "Errore server" }, 500);
  }
}

const GALLERY_MAX_BYTES = 2_500_000; // ~2.5MB dopo compressione client
const GALLERY_META_KEY = "gallery-meta";
const GALLERY_FEATURED_MAX = 15;
const GALLERY_BRANCHES = new Set(["gruppo", "lupetti", "reparto", "noviziato", "clan"]);

function galleryIdOk(id) {
  return /^[a-zA-Z0-9_-]{6,80}$/.test(String(id || ""));
}

function normalizeGalleryMeta(raw) {
  const items = Array.isArray(raw?.items)
    ? raw.items.map((it) => ({
        ...it,
        branca: GALLERY_BRANCHES.has(it.branca) ? it.branca : "gruppo",
        folderId: it.folderId || null,
        featured: !!it.featured,
        featuredOrder: Number.isFinite(Number(it.featuredOrder)) ? Number(it.featuredOrder) : 0,
      }))
    : [];
  const folders = Array.isArray(raw?.folders) ? raw.folders : [];
  return { items, folders, updatedAt: raw?.updatedAt || null };
}

async function saveGalleryMeta(kv, meta) {
  const payload = {
    items: meta.items || [],
    folders: meta.folders || [],
    updatedAt: new Date().toISOString(),
  };
  await kv.put(GALLERY_META_KEY, JSON.stringify(payload));
  return payload;
}

async function handleGallery(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const kv = env.SCOUT_KV;
  const r2 = env.SCOUT_R2;
  if (!kv || !r2) {
    return json(
      {
        error:
          !r2
            ? "Galleria non configurata: crea il bucket R2 “firenze1-gallery” e il binding SCOUT_R2."
            : "Sync KV mancante (SCOUT_KV).",
      },
      503
    );
  }

  const url = new URL(request.url);

  try {
    if (request.method === "GET") {
      if (url.pathname.startsWith("/api/gallery/file")) {
        const id = String(url.searchParams.get("id") || "").trim();
        if (!galleryIdOk(id)) return json({ error: "id non valido" }, 400);
        const obj = await r2.get(`gallery/${id}`);
        if (!obj) return json({ error: "immagine non trovata" }, 404);
        const headers = corsHeaders({
          "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
          "Cache-Control": "public, max-age=86400",
        });
        return new Response(obj.body, { status: 200, headers });
      }

      const data = normalizeGalleryMeta(
        await kvGetJson(kv, GALLERY_META_KEY, { items: [], folders: [], updatedAt: null })
      );
      data.items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      data.folders.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "it"));
      return json(data);
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
      let meta = normalizeGalleryMeta(
        await kvGetJson(kv, GALLERY_META_KEY, { items: [], folders: [], updatedAt: null })
      );
      let items = [...meta.items];
      let folders = [...meta.folders];

      if (resource === "upload") {
        const id = String(body.id || "").trim();
        if (!galleryIdOk(id)) return json({ error: "id non valido" }, 400);
        const branca = String(body.branca || "").trim();
        if (!GALLERY_BRANCHES.has(branca)) {
          return json({ error: "Seleziona branca o gruppo." }, 400);
        }
        const folderId = body.folderId ? String(body.folderId).trim() : null;
        if (folderId && !folders.some((f) => f.id === folderId)) {
          return json({ error: "Cartella non trovata." }, 400);
        }
        const b64 = String(body.dataBase64 || "");
        if (!b64) return json({ error: "immagine mancante" }, 400);
        let binary;
        try {
          binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        } catch {
          return json({ error: "base64 non valido" }, 400);
        }
        if (binary.byteLength > GALLERY_MAX_BYTES) {
          return json({ error: "immagine troppo grande (max circa 2.5 MB)" }, 400);
        }
        const contentType = String(body.contentType || "image/jpeg").slice(0, 80);
        if (!/^image\/(jpeg|png|webp|gif)$/i.test(contentType)) {
          return json({ error: "formato immagine non supportato" }, 400);
        }
        await r2.put(`gallery/${id}`, binary, {
          httpMetadata: { contentType },
        });
        const item = {
          id,
          title: String(body.title || "").trim().slice(0, 120),
          caption: String(body.caption || "").trim().slice(0, 400),
          branca,
          folderId,
          featured: false,
          featuredOrder: 0,
          contentType,
          size: binary.byteLength,
          createdAt: new Date().toISOString(),
        };
        items = items.filter((x) => x.id !== id);
        items.unshift(item);
        const payload = await saveGalleryMeta(kv, { items, folders });
        return json({ ok: true, item, ...payload });
      }

      if (resource === "delete") {
        const id = String(body.id || "").trim();
        if (!galleryIdOk(id)) return json({ error: "id non valido" }, 400);
        await r2.delete(`gallery/${id}`);
        items = items.filter((x) => x.id !== id);
        const payload = await saveGalleryMeta(kv, { items, folders });
        return json({ ok: true, ...payload });
      }

      if (resource === "update") {
        const id = String(body.id || "").trim();
        const item = items.find((x) => x.id === id);
        if (!item) return json({ error: "foto non trovata" }, 404);
        if (body.title != null) item.title = String(body.title || "").trim().slice(0, 120);
        if (body.caption != null) item.caption = String(body.caption || "").trim().slice(0, 400);
        if (body.branca != null) {
          const branca = String(body.branca || "").trim();
          if (!GALLERY_BRANCHES.has(branca)) return json({ error: "Branca non valida." }, 400);
          item.branca = branca;
        }
        if (body.folderId !== undefined) {
          const folderId = body.folderId ? String(body.folderId).trim() : null;
          if (folderId && !folders.some((f) => f.id === folderId)) {
            return json({ error: "Cartella non trovata." }, 400);
          }
          item.folderId = folderId;
        }
        const payload = await saveGalleryMeta(kv, { items, folders });
        return json({ ok: true, item, ...payload });
      }

      if (resource === "set-featured") {
        const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x)) : [];
        if (ids.length > GALLERY_FEATURED_MAX) {
          return json({ error: `Massimo ${GALLERY_FEATURED_MAX} foto in primo piano.` }, 400);
        }
        const idSet = new Set(ids);
        for (const item of items) {
          const idx = ids.indexOf(item.id);
          item.featured = idx >= 0;
          item.featuredOrder = idx >= 0 ? idx : 0;
        }
        // ignore unknown ids silently
        if ([...idSet].some((id) => !items.some((it) => it.id === id))) {
          /* ok */
        }
        const payload = await saveGalleryMeta(kv, { items, folders });
        return json({ ok: true, ...payload });
      }

      if (resource === "folder-create") {
        const name = String(body.name || "").trim().slice(0, 80);
        if (!name) return json({ error: "Nome cartella obbligatorio." }, 400);
        const folder = {
          id: `fold_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`,
          name,
          createdAt: new Date().toISOString(),
        };
        folders.push(folder);
        const payload = await saveGalleryMeta(kv, { items, folders });
        return json({ ok: true, folder, ...payload });
      }

      if (resource === "folder-rename") {
        const id = String(body.id || "").trim();
        const folder = folders.find((f) => f.id === id);
        if (!folder) return json({ error: "Cartella non trovata." }, 404);
        const name = String(body.name || "").trim().slice(0, 80);
        if (!name) return json({ error: "Nome cartella obbligatorio." }, 400);
        folder.name = name;
        const payload = await saveGalleryMeta(kv, { items, folders });
        return json({ ok: true, folder, ...payload });
      }

      if (resource === "folder-delete") {
        const id = String(body.id || "").trim();
        folders = folders.filter((f) => f.id !== id);
        for (const item of items) {
          if (item.folderId === id) item.folderId = null;
        }
        const payload = await saveGalleryMeta(kv, { items, folders });
        return json({ ok: true, ...payload });
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
    if (url.pathname === "/api/gcal" || url.pathname.startsWith("/api/gcal/")) {
      return handleGcal(request, env);
    }
    if (url.pathname === "/api/gallery" || url.pathname.startsWith("/api/gallery/")) {
      return handleGallery(request, env);
    }
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
