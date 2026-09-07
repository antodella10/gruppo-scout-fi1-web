document.addEventListener("DOMContentLoaded", () => {
  const user = ScoutStore.getCurrentUser();
  if (!user) {
    location.href = "./login.html";
    return;
  }

  const isAdmin = !!(user.isAdmin || ScoutStore.isAdminEmail(user.email));
  const nameEl = document.getElementById("staff-name");
  const metaEl = document.getElementById("staff-meta");
  if (nameEl) nameEl.textContent = `${user.nome} ${user.cognome}`;
  if (metaEl) {
    metaEl.textContent = isAdmin
      ? `Admin generale · ${ScoutStore.branchLabel(user.branca)}`
      : `Staff ${ScoutStore.branchLabel(user.branca)}`;
  }

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    ScoutStore.logout();
    location.href = "../index.html";
  });

  const adminPanel = document.getElementById("admin-panel");
  if (adminPanel) adminPanel.hidden = !isAdmin;

  const gcalForm = document.getElementById("gcal-form");
  const gcalHint = document.getElementById("gcal-hint");
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
    if (isAdmin) {
      gcalForm.hidden = false;
      if (gcalHint) {
        gcalHint.innerHTML =
          "Solo l’admin (mail di gruppo) può collegare o cambiare il Google Calendar.";
      }
      gcalForm.googleEmbed.value = settings.googleCalendarEmbed || "";
      gcalForm.addEventListener("submit", (e) => {
        e.preventDefault();
        try {
          const url = gcalForm.googleEmbed.value.trim();
          ScoutStore.saveSettings({ googleCalendarEmbed: url }, user);
          renderGcal(url);
        } catch (err) {
          alert(err.message);
        }
      });
    } else if (gcalHint) {
      gcalHint.textContent = "Calendario configurato dall’admin — solo visualizzazione.";
    }
    renderGcal(settings.googleCalendarEmbed || "");
  }

  // —— Events ——
  const eventForm = document.getElementById("event-form");
  const eventList = document.getElementById("staff-event-list");
  const eventAlert = document.getElementById("event-alert");
  const scopeSelect = document.getElementById("event-scope");
  const submitBtn = document.getElementById("event-submit");
  const cancelEditBtn = document.getElementById("cancel-edit");
  let editingId = null;

  function fillScopeOptions() {
    if (!scopeSelect) return;
    const brancaLabel = ScoutStore.branchLabel(user.branca);
    scopeSelect.innerHTML = `
      <option value="gruppo">Gruppo</option>
      <option value="branca">${escapeHtml(brancaLabel)}</option>
      <option value="staff">Staff ${escapeHtml(brancaLabel)}</option>
      <option value="coca">Co.Ca.</option>
    `;
  }

  function showAlert(msg, ok = true) {
    if (!eventAlert) return;
    eventAlert.hidden = false;
    eventAlert.className = ok ? "alert alert-ok" : "alert alert-error";
    eventAlert.textContent = msg;
  }

  function resetForm() {
    editingId = null;
    eventForm?.reset();
    fillScopeOptions();
    if (submitBtn) submitBtn.textContent = "Aggiungi attività";
    if (cancelEditBtn) cancelEditBtn.hidden = true;
  }

  function refreshEvents() {
    const events = ScoutStore.getManageableEvents(user);
    if (!eventList) return;
    if (!events.length) {
      eventList.innerHTML = `<div class="empty-state">Nessun evento gestibile. Aggiungine uno qui sopra.</div>`;
      return;
    }
    eventList.innerHTML = events
      .map(
        (e) => `
        <div class="event-admin-item" data-id="${e.id}">
          <div>
            ${eventBadge(e)}
            <strong style="display:inline-block;margin-left:.35rem">${escapeHtml(e.title)}</strong><br>
            <span style="color:var(--muted)">${escapeHtml(e.date)}${e.time ? " · " + escapeHtml(e.time) : ""}${e.place ? " · " + escapeHtml(e.place) : ""}</span>
          </div>
          <div class="inline-actions">
            <button type="button" class="btn btn-ghost btn-small" data-edit="${e.id}">Modifica</button>
            <button type="button" class="btn btn-ghost btn-small" data-delete="${e.id}">Elimina</button>
          </div>
        </div>`
      )
      .join("");
  }

  function startEdit(id) {
    const event = ScoutStore.getEvents().find((e) => e.id === id);
    if (!event || !ScoutStore.canManageEvent(user, event)) return;
    editingId = id;
    eventForm.title.value = event.title;
    eventForm.date.value = event.date;
    eventForm.time.value = event.time || "";
    eventForm.place.value = event.place || "";
    eventForm.notes.value = event.notes || "";
    fillScopeOptions();
    scopeSelect.value = event.scope;
    if (submitBtn) submitBtn.textContent = "Salva modifiche";
    if (cancelEditBtn) cancelEditBtn.hidden = false;
    eventForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  fillScopeOptions();

  eventForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(eventForm);
    const payload = {
      title: data.get("title"),
      date: data.get("date"),
      time: data.get("time"),
      place: data.get("place"),
      notes: data.get("notes"),
      scope: data.get("scope"),
      branca: user.branca,
    };
    try {
      if (editingId) {
        ScoutStore.updateEvent(editingId, payload, user);
        showAlert("Evento aggiornato.");
      } else {
        ScoutStore.addEvent(payload, user);
        showAlert("Attività aggiunta.");
      }
      resetForm();
      refreshEvents();
    } catch (err) {
      showAlert(err.message || "Operazione non riuscita.", false);
    }
  });

  cancelEditBtn?.addEventListener("click", () => resetForm());

  eventList?.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-edit]");
    if (editBtn) {
      startEdit(editBtn.dataset.edit);
      return;
    }
    const delBtn = e.target.closest("[data-delete]");
    if (!delBtn) return;
    if (!confirm("Eliminare questa attività?")) return;
    try {
      ScoutStore.deleteEvent(delBtn.dataset.delete, user);
      if (editingId === delBtn.dataset.delete) resetForm();
      refreshEvents();
    } catch (err) {
      alert(err.message);
    }
  });

  refreshEvents();
});
