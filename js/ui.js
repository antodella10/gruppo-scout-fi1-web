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

function renderMonthCalendar(container, events, viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const today = ymd(new Date());
  const eventDates = new Set(events.map((e) => e.date));

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
    if (eventDates.has(key)) classes.push("has-event");

    html += `<div class="${classes.join(" ")}" data-date="${key}" title="${key}">${day}</div>`;
  }

  container.innerHTML = html;
}

function renderEventList(container, events, { upcomingOnly = true, limit = 8 } = {}) {
  const today = ymd(new Date());
  let list = [...events];
  if (upcomingOnly) list = list.filter((e) => e.date >= today);
  list = list.slice(0, limit);

  if (!list.length) {
    container.innerHTML = `<div class="empty-state">Nessuna attività in programma. Lo staff può aggiungerle dall'area riservata.</div>`;
    return;
  }

  container.innerHTML = list
    .map(
      (e) => `
      <article class="event-item">
        <div class="event-date">
          <span class="day">${dayNumber(e.date)}</span>
          <span class="mon">${formatShortMonth(e.date)}</span>
        </div>
        <div>
          <h4>${escapeHtml(e.title)}</h4>
          <p>
            ${e.time ? escapeHtml(e.time) + " · " : ""}${e.place ? escapeHtml(e.place) : "Luogo da definire"}
            ${e.notes ? "<br>" + escapeHtml(e.notes) : ""}
          </p>
        </div>
      </article>`
    )
    .join("");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function updateNavAuth() {
  const slot = document.querySelector("[data-auth-slot]");
  if (!slot) return;
  const user = ScoutStore.getSession();
  const base = slot.dataset.base || "";
  if (user) {
    slot.innerHTML = `
      <span class="user-chip">${escapeHtml(user.nome)} ${escapeHtml(user.cognome)}</span>
      <a class="btn btn-primary btn-small" href="${base}staff/">Area staff</a>
    `;
  } else {
    slot.innerHTML = `<a class="btn btn-yellow btn-small" href="${base}staff/login.html">Login staff</a>`;
  }
}

document.addEventListener("DOMContentLoaded", updateNavAuth);
