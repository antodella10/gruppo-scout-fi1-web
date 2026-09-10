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
    if (typeof StaffNotifs !== "undefined") {
      const c = StaffNotifs.counts(full);
      if (c.total > 0) badge = StaffNotifs.badgeHtml(c.total, StaffNotifs.titleFor(c));
    } else if (typeof CanzoniereStore !== "undefined" && CanzoniereStore.canManage(full)) {
      const n = CanzoniereStore.pendingProposalsCount();
      if (n > 0) {
        badge = `<span class="notif-badge" title="Proposte canzoni">${n > 9 ? "9+" : n}</span>`;
      }
    }
    slot.innerHTML = `
      <span class="user-chip">${escapeHtml(full.nome)} ${escapeHtml(full.cognome)}${br ? " · " + escapeHtml(br) : ""}${badge}</span>
      <a class="btn btn-primary btn-small" href="${base}staff/">Area staff</a>
      <button type="button" class="btn btn-ghost btn-small" data-nav-logout>Esci</button>
    `;
    slot.querySelector("[data-nav-logout]")?.addEventListener("click", () => {
      ScoutStore.logout();
      location.href = `${base}index.html`;
    });
  } else {
    slot.innerHTML = `<a class="btn btn-yellow btn-small" href="${base}staff/login.html">Login staff</a>`;
  }
}

function socialIconFb() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 9h3V6h-3c-1.9 0-3 1.3-3 3v2H8v3h3v7h3v-7h3l1-3h-4V9c0-.3.1-.5.5-.5H14z"/></svg>`;
}

function socialIconIg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 4.5A4.5 4.5 0 1 0 16.5 12 4.5 4.5 0 0 0 12 7.5zm5.2-.9a1.1 1.1 0 1 0 1.1 1.1 1.1 1.1 0 0 0-1.1-1.1zM12 9.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5z"/></svg>`;
}

/** Home: “Seguici” con icone (sempre ricostruisce il blocco). */
function renderSocialFollow(container) {
  if (!container) return;

  let social = null;
  try {
    if (typeof ScoutStore !== "undefined" && ScoutStore.getSocialLinks) {
      social = ScoutStore.getSocialLinks();
    }
  } catch (err) {
    console.warn("[social]", err);
  }
  if (!social) social = window.SCOUT_CONFIG?.social || {};

  const cfg = window.SCOUT_CONFIG?.social || {};
  const fbRaw = social.facebook;
  let fbUrl = String((typeof fbRaw === "object" ? fbRaw?.url : fbRaw) || "").trim();
  if (!fbUrl) {
    fbUrl = String(cfg.facebook?.url || cfg.facebook || "https://www.facebook.com/scoutfirenze1/?locale=it_IT").trim();
  }
  const fbLabel =
    (typeof fbRaw === "object" && fbRaw?.label) || cfg.facebook?.label || "Facebook";

  const igKey = social.homeInstagram || cfg.homeInstagram || "reparto";
  const igMap = social.instagram || cfg.instagram || {};
  const igRaw = igMap[igKey] || igMap.reparto || cfg.instagram?.reparto || {};
  let igUrl = String((typeof igRaw === "object" ? igRaw?.url : igRaw) || "").trim();
  if (!igUrl) {
    igUrl = String(cfg.instagram?.reparto?.url || "https://www.instagram.com/riparto.fi1").trim();
  }
  const igLabel =
    (typeof igRaw === "object" && igRaw?.label) || "Instagram";

  container.innerHTML = `
    <div class="social-follow">
      <span class="social-follow-label">Seguici:</span>
      <div class="social-icon-row">
        <a class="social-icon-btn social-icon-ig" data-social="ig" href="${escapeHtml(igUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(igLabel)}" aria-label="${escapeHtml(igLabel)}">${socialIconIg()}</a>
        <a class="social-icon-btn social-icon-fb" data-social="fb" href="${escapeHtml(fbUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(fbLabel)}" aria-label="${escapeHtml(fbLabel)}">${socialIconFb()}</a>
      </div>
    </div>`;
}

function flashAlert(el, msg, ok = true) {
  if (!el) return;
  el.hidden = false;
  el.className = ok ? "alert alert-ok" : "alert alert-error";
  el.textContent = msg;
  el.classList.remove("is-flashing");
  // reflow per rieseguire l’animazione anche se il testo è uguale
  void el.offsetWidth;
  el.classList.add("is-flashing");
}

/** Elenco completo (Chi siamo): tutti i link con nome. */
function renderSocialFull(container) {
  if (!container) return;
  const social =
    typeof ScoutStore !== "undefined" && ScoutStore.getSocialLinks
      ? ScoutStore.getSocialLinks()
      : null;
  if (!social) {
    container.innerHTML = "";
    return;
  }
  const items = [];
  if (social.facebook?.url) {
    items.push({
      kind: "fb",
      label: social.facebook.label || "Facebook",
      url: social.facebook.url,
    });
  }
  ["gruppo", "lupetti", "reparto", "noviziato", "clan"].forEach((id) => {
    const ig = social.instagram?.[id];
    if (ig?.url) {
      items.push({ kind: "ig", label: ig.label || id, url: ig.url });
    }
  });
  if (!items.length) {
    container.innerHTML = `<p class="hint" style="margin:0">Social non ancora configurati.</p>`;
    return;
  }
  container.innerHTML = `
    <ul class="social-full-list">
      ${items
        .map(
          (it) => `
        <li>
          <a href="${escapeHtml(it.url)}" target="_blank" rel="noopener noreferrer">
            <span class="social-full-icon">${it.kind === "fb" ? socialIconFb() : socialIconIg()}</span>
            <span>${escapeHtml(it.label)}</span>
          </a>
        </li>`
        )
        .join("")}
    </ul>`;
}

/** Compat: footer compact → icone seguici. */
function renderSocialLinks(container, { compact = false, full = false } = {}) {
  if (full) return renderSocialFull(container);
  return renderSocialFollow(container);
}

function renderMeetingHoursList(container, { compact = false } = {}) {
  if (!container || typeof ScoutStore === "undefined") return;
  const hours = ScoutStore.getMeetingHours();
  if (!hours.length) {
    container.innerHTML = `<div class="empty-state">Orari non ancora impostati.</div>`;
    return;
  }
  if (compact) {
    container.innerHTML = `
      <ul class="meeting-hours-compact">
        ${hours
          .map((h) => {
            const label = h.label || ScoutStore.branchLabel(h.branca);
            const when = [h.day, h.time].filter(Boolean).join(" · ") || "Da definire";
            return `<li><span class="mh-branca">${escapeHtml(label)}</span><span class="mh-when">${escapeHtml(when)}</span></li>`;
          })
          .join("")}
      </ul>`;
    return;
  }
  container.innerHTML = `
    <ul class="meeting-hours-list">
      ${hours
        .map((h) => {
          const label = h.label || ScoutStore.branchLabel(h.branca);
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
  if (typeof StaffNotifs !== "undefined" && ScoutStore.getSession?.()) {
    StaffNotifs.pullAll().then(() => updateNavAuth());
  }
  // Social anche senza home.js (pagine statiche / fallback)
  renderSocialFollow(document.getElementById("contact-social"));
  renderSocialFollow(document.getElementById("footer-social"));
});

