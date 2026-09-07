document.addEventListener("DOMContentLoaded", () => {
  const user = ScoutStore.getCurrentUser();
  if (!user) {
    location.href = "./login.html";
    return;
  }

  const nameEl = document.getElementById("staff-name");
  if (nameEl) nameEl.textContent = `${user.nome} ${user.cognome}`;

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    ScoutStore.logout();
    location.href = "../index.html";
  });

  // —— Activity events CRUD ——
  const eventForm = document.getElementById("event-form");
  const eventList = document.getElementById("staff-event-list");
  const eventAlert = document.getElementById("event-alert");

  function refreshEvents() {
    const events = ScoutStore.getEvents();
    if (!eventList) return;
    if (!events.length) {
      eventList.innerHTML = `<div class="empty-state">Nessun evento ancora. Aggiungine uno qui sopra.</div>`;
      return;
    }
    eventList.innerHTML = events
      .map(
        (e) => `
        <div class="event-admin-item" data-id="${e.id}">
          <div>
            <strong>${escapeHtml(e.title)}</strong><br>
            <span style="color:var(--muted)">${escapeHtml(e.date)}${e.time ? " · " + escapeHtml(e.time) : ""}${e.place ? " · " + escapeHtml(e.place) : ""}</span>
          </div>
          <button type="button" class="btn btn-ghost btn-small" data-delete="${e.id}">Elimina</button>
        </div>`
      )
      .join("");
  }

  eventForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(eventForm);
    ScoutStore.addEvent({
      title: data.get("title"),
      date: data.get("date"),
      time: data.get("time"),
      place: data.get("place"),
      notes: data.get("notes"),
      createdBy: user.id,
    });
    eventForm.reset();
    if (eventAlert) {
      eventAlert.hidden = false;
      eventAlert.className = "alert alert-ok";
      eventAlert.textContent = "Attività aggiunta: comparirà nel calendario della home.";
    }
    refreshEvents();
  });

  eventList?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete]");
    if (!btn) return;
    if (!confirm("Eliminare questa attività?")) return;
    ScoutStore.deleteEvent(btn.dataset.delete);
    refreshEvents();
  });

  refreshEvents();

  // —— Google Calendar embed settings ——
  const gcalForm = document.getElementById("gcal-form");
  const gcalFrame = document.getElementById("gcal-frame");
  const gcalEmpty = document.getElementById("gcal-empty");
  const settings = ScoutStore.getSettings();

  function renderGcal(url) {
    if (!gcalFrame || !gcalEmpty) return;
    if (url && url.includes("google.com/calendar")) {
      gcalFrame.hidden = false;
      gcalEmpty.hidden = true;
      gcalFrame.src = url;
    } else {
      gcalFrame.hidden = true;
      gcalFrame.removeAttribute("src");
      gcalEmpty.hidden = false;
    }
  }

  if (gcalForm) {
    gcalForm.googleEmbed.value = settings.googleCalendarEmbed || "";
    renderGcal(settings.googleCalendarEmbed || "");

    gcalForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const url = gcalForm.googleEmbed.value.trim();
      ScoutStore.saveSettings({ googleCalendarEmbed: url });
      renderGcal(url);
    });
  }
});
