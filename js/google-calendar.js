/* Carica eventi Google e li unisce al calendario del sito. */
window.GoogleCal = (() => {
  const cache = new Map();
  const CACHE_MS = 2 * 60 * 1000;

  function extractCalendarId(input) {
    const raw = String(input || "").trim();
    if (!raw) return "";
    try {
      if (raw.includes("://")) {
        const url = new URL(raw);
        const src = url.searchParams.get("src") || url.searchParams.get("cid");
        if (src) return decodeURIComponent(src);
        const ical = raw.match(/\/ical\/([^/]+)\/public\//i);
        if (ical) return decodeURIComponent(ical[1]);
      }
    } catch (_) {
      /* ignore */
    }
    if (/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+$/.test(raw) || raw.includes("group.calendar.google.com")) {
      return raw;
    }
    return raw;
  }

  function rangeForMonth(viewDate) {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m + 2, 0);
    const fmt = (d) => {
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yy}-${mm}-${dd}`;
    };
    return { from: fmt(from), to: fmt(to) };
  }

  async function fetchViaApi(calendarId, from, to, apiKey) {
    const params = new URLSearchParams({
      key: apiKey,
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: `${from}T00:00:00Z`,
      timeMax: `${to}T23:59:59Z`,
      maxResults: "250",
    });
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error?.message || "API Google Calendar non disponibile.");
    }
    return (data.items || []).map((item) => {
      const start = item.start || {};
      const end = item.end || {};
      const allDay = !!start.date;
      let dateStart = start.date || (start.dateTime || "").slice(0, 10);
      let dateEnd = end.date || (end.dateTime || "").slice(0, 10) || dateStart;
      if (allDay && dateEnd && dateEnd > dateStart) {
        // API all-day end is exclusive
        const [y, m, d] = dateEnd.split("-").map(Number);
        const dt = new Date(y, m - 1, d - 1);
        dateEnd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
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
        time,
      };
    });
  }

  async function fetchViaProxy(calendarId, from, to) {
    const params = new URLSearchParams({ id: calendarId, from, to });
    const endpoints = ["/api/gcal", "/.netlify/functions/gcal-events"];
    let lastErr = null;

    for (const base of endpoints) {
      try {
        const res = await fetch(`${base}?${params}`, { cache: "no-store" });
        if (res.status === 404) {
          lastErr = new Error("Proxy calendario non trovato su questo host.");
          continue;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          lastErr = new Error(data.error || `Proxy calendario fallito (${res.status})`);
          continue;
        }
        return data.events || [];
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr || new Error("Impossibile sincronizzare Google Calendar.");
  }

  async function loadCalendarEvents(calendar, viewDate) {
    const calendarId = calendar.calendarId || extractCalendarId(calendar.embedUrl);
    if (!calendarId) return [];
    const { from, to } = rangeForMonth(viewDate);
    const cacheKey = `${calendarId}|${from}|${to}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.events;

    const apiKey = window.SCOUT_CONFIG?.googleCalendarApiKey || "";
    let raw;
    try {
      if (apiKey) raw = await fetchViaApi(calendarId, from, to, apiKey);
      else raw = await fetchViaProxy(calendarId, from, to);
    } catch (err) {
      console.warn("[GoogleCal]", calendarId, err.message);
      if (hit?.events?.length) return hit.events;
      throw err;
    }

    const mapped = raw.map((e) => ({
      id: `gcal_${calendar.id}_${e.uid}`,
      title: e.title,
      description: e.description || "",
      notes: e.description || "",
      place: e.place || "",
      dateStart: e.dateStart,
      dateEnd: e.dateEnd || e.dateStart,
      date: e.dateStart,
      allDay: !!e.allDay || !e.time,
      time: e.allDay ? "" : e.time || "",
      scope: "google",
      branca: calendar.branca === "gruppo" ? null : calendar.branca,
      fromGoogle: true,
      googleBranca: calendar.branca,
    }));

    cache.set(cacheKey, { at: Date.now(), events: mapped });
    return mapped;
  }

  async function loadForView(selectedBranca, viewDate) {
    const calendars =
      typeof ScoutStore !== "undefined" ? ScoutStore.getGoogleCalendarsForView(selectedBranca) : [];
    if (!calendars.length) return [];
    const results = await Promise.allSettled(calendars.map((c) => loadCalendarEvents(c, viewDate)));
    const events = [];
    const errors = [];
    for (const r of results) {
      if (r.status === "fulfilled") events.push(...r.value);
      else errors.push(r.reason?.message || "errore sync");
    }
    if (!events.length && errors.length) {
      throw new Error(errors[0]);
    }
    return events;
  }

  function clearCache() {
    cache.clear();
  }

  return { extractCalendarId, loadForView, loadCalendarEvents, clearCache };
})();
