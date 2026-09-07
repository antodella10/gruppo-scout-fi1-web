/* Proxy eventi Google Calendar (ICS pubblico) → JSON. Evita CORS e iframe. */
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

function addDays(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function parseEvents(icsText) {
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
      // ICS all-day DTEND is exclusive
      dateEnd = addDays(dateEnd, -1);
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
    });
  }
  return events;
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=120",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const params = event.queryStringParameters || {};
    const calendarId = String(params.id || "").trim();
    if (!calendarId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "id calendario mancante" }) };
    }

    const icsUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
    const res = await fetch(icsUrl, {
      headers: { "User-Agent": "Firenze1ScoutSite/1.0" },
    });

    if (!res.ok) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error:
            "Calendario Google non raggiungibile. Rendi il calendario pubblico (Impostazioni → Accessibilità → Rendi disponibile al pubblico).",
          status: res.status,
        }),
      };
    }

    const ics = await res.text();
    let events = parseEvents(ics);

    const from = params.from || "";
    const to = params.to || "";
    if (from) events = events.filter((e) => (e.dateEnd || e.dateStart) >= from);
    if (to) events = events.filter((e) => e.dateStart <= to);

    events.sort((a, b) => a.dateStart.localeCompare(b.dateStart) || (a.time || "").localeCompare(b.time || ""));

    return { statusCode: 200, headers, body: JSON.stringify({ events }) };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || "Errore server" }),
    };
  }
};
