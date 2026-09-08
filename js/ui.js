function formatMonthYear(date) {
  return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

function formatShortMonth(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("it-IT", { month: "short" });
}

function dayNumber(dateStr) {
  return new Date(dateStr + "T12:00:00").getDate();
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function eventBadge(event) {
  const label = ScoutStore.scopeLabel(event.scope, event.branca || event.googleBranca);
  const cls =
    event.scope === "google" || event.fromGoogle
      ? "badge-google"
      : event.scope === "gruppo"
        ? "badge-gruppo"
        : event.scope === "coca"
          ? "badge-coca"
          : event.scope === "staff"
            ? "badge-staff"
            : "badge-branca";
  return `<span class="event-badge ${cls}">${escapeHtml(label)}</span>`;
}

function eventCoversDate(event, dateKey) {
  const start = event.dateStart || event.date || "";
  const end = event.dateEnd || start;
  if (!start) return false;
  return dateKey >= start && dateKey <= end;
}

function formatEventRange(event) {
  const start = event.dateStart || event.date || "";
  const end = event.dateEnd || start;
  if (!start) return "";
  const allDay = event.allDay || !event.time;
  if (allDay) {
    if (end && end !== start) return `${start} → ${end}`;
    return start;
  }
  const time = `${event.time} · `;
  if (end && end !== start) return `${time}${start} → ${end}`;
  return `${time}${start}`;
}

function renderMonthCalendar(container, events, viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const today = ymd(new Date());

  const dows = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  let html = dows.map((d) => `<div class="cal-dow">${d}</div>`).join("");

  for (let i = 0; i < 42; i++) {
    let day;
    let muted = false;
    let dateObj;

    if (i < startOffset) {
      day = daysInPrev - startOffset + i + 1;
      dateObj = new Date(year, month - 1, day);
      muted = true;
    } else if (i >= startOffset + daysInMonth) {
      day = i - startOffset - daysInMonth + 1;
      dateObj = new Date(year, month + 1, day);
      muted = true;
    } else {
      day = i - startOffset + 1;
      dateObj = new Date(year, month, day);
    }

    const key = ymd(dateObj);
    const classes = ["cal-day"];
    if (muted) classes.push("muted");
    if (key === today) classes.push("today");
    if (events.some((e) => eventCoversDate(e, key))) classes.push("has-event");

    html += `<div class="${classes.join(" ")}" data-date="${key}" title="${key}">${day}</div>`;
  }

  container.innerHTML = html;
}

function renderEventList(container, events, { upcomingOnly = true, limit = 10 } = {}) {
  const today = ymd(new Date());
  let list = [...events];
  if (upcomingOnly) {
    list = list.filter((e) => (e.dateEnd || e.dateStart || e.date || "") >= today);
  }
  list = list.slice(0, limit);

  if (!list.length) {
    container.innerHTML = `<div class="empty-state">Nessuna attività in programma per questa vista.</div>`;
    return;
  }

  container.innerHTML = list
    .map((e) => {
      const start = e.dateStart || e.date || "";
      const desc = e.description || e.notes || "";
      return `
      <article class="event-item">
        <div class="event-date">
          <span class="day">${dayNumber(start)}</span>
          <span class="mon">${formatShortMonth(start)}</span>
        </div>
        <div>
          <div class="event-item-top">${eventBadge(e)}</div>
          <h4>${escapeHtml(e.title)}</h4>
          <p>
            ${escapeHtml(formatEventRange(e))}
            ${e.place ? " · " + escapeHtml(e.place) : ""}
            ${desc ? "<br>" + escapeHtml(desc) : ""}
          </p>
        </div>
      </article>`;
    })
    .join("");
}

function updateNavAuth() {
  const slot = document.querySelector("[data-auth-slot]");
  if (!slot) return;
  const user = ScoutStore.getSession();
  const base = slot.dataset.base || "";
  if (user) {
    const full = ScoutStore.getCurrentUser() || user;
    const br = full.isAdmin
      ? "Admin"
      : full.branca
        ? ScoutStore.branchLabel(full.branca)
        : "";
    let badge = "";
    if (typeof CanzoniereStore !== "undefined" && CanzoniereStore.canManage(full)) {
      const n = CanzoniereStore.pendingProposalsCount();
      if (n > 0) {
        badge = `<span class="notif-badge" title="Proposte canzoni">${n > 9 ? "9+" : n}</span>`;
      }
    }
    slot.innerHTML = `
      <span class="user-chip">${escapeHtml(full.nome)} ${escapeHtml(full.cognome)}${br ? " · " + escapeHtml(br) : ""}${badge}</span>
      <a class="btn btn-primary btn-small" href="${base}staff/">Area staff</a>
    `;
  } else {
    slot.innerHTML = `<a class="btn btn-yellow btn-small" href="${base}staff/login.html">Login staff</a>`;
  }
}

function renderSocialLinks(container, { compact = false } = {}) {
  if (!container) return;
  const social = window.SCOUT_CONFIG?.social || {};
  const fb = (social.facebook || "").trim();
  const ig = social.instagram || {};
  const igEntries = [
    ["gruppo", "Gruppo"],
    ...Object.values(window.SCOUT_BRANCHES || {}).map((b) => [b.id, b.label]),
  ]
    .map(([id, label]) => ({ id, label, url: String(ig[id] || "").trim() }))
    .filter((x) => x.url);

  const parts = [];
  if (fb) {
    parts.push(
      `<a class="social-link social-fb" href="${escapeHtml(fb)}" target="_blank" rel="noopener noreferrer">Facebook</a>`
    );
  }
  if (igEntries.length) {
    const igList = igEntries
      .map(
        (x) =>
          `<a class="social-ig-item" href="${escapeHtml(x.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(x.label)}</a>`
      )
      .join("");
    parts.push(
      `<div class="social-ig ${compact ? "is-compact" : ""}"><span class="social-ig-label">Instagram</span><div class="social-ig-list">${igList}</div></div>`
    );
  }

  if (!parts.length) {
    container.innerHTML = `<p class="hint" style="margin:0">Social in arrivo — i link si configurano in <code>js/config.js</code>.</p>`;
    return;
  }
  container.innerHTML = `<div class="social-row">${parts.join("")}</div>`;
}

function renderMeetingHoursList(container) {
  if (!container || typeof ScoutStore === "undefined") return;
  const hours = ScoutStore.getMeetingHours();
  if (!hours.length) {
    container.innerHTML = `<div class="empty-state">Orari non ancora impostati.</div>`;
    return;
  }
  container.innerHTML = `
    <ul class="meeting-hours-list">
      ${hours
        .map((h) => {
          const label = ScoutStore.branchLabel(h.branca);
          const when = [h.day, h.time].filter(Boolean).join(" · ") || "Da definire";
          const place = h.place ? `<span class="mh-place">${escapeHtml(h.place)}</span>` : "";
          return `<li>
            <span class="mh-branca">${escapeHtml(label)}</span>
            <span class="mh-when">${escapeHtml(when)}</span>
            ${place}
          </li>`;
        })
        .join("")}
    </ul>`;
}

document.addEventListener("DOMContentLoaded", () => {
  if (typeof BranchView !== "undefined") BranchView.wireHomeLinks();
  updateNavAuth();
});

