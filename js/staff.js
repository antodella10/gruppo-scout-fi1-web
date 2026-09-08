document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "attivita" });
  if (!user) return;

  const isAdmin = StaffShell.isAdmin(user);
  const eventHint = document.getElementById("event-hint");
  if (eventHint) {
    eventHint.textContent = isAdmin
      ? "Come admin puoi creare e modificare qualsiasi evento di qualsiasi branca."
      : `Puoi creare eventi Gruppo, ${ScoutStore.branchLabel(user.branca)}, Staff ${ScoutStore.branchLabel(user.branca)} e Co.Ca.`;
  }

  const eventForm = document.getElementById("event-form");
  const eventList = document.getElementById("staff-event-list");
  const eventAlert = document.getElementById("event-alert");
  const scopeSelect = document.getElementById("event-scope");
  const brancaWrap = document.getElementById("event-branca-wrap");
  const brancaSelect = document.getElementById("event-branca");
  const submitBtn = document.getElementById("event-submit");
  const cancelEditBtn = document.getElementById("cancel-edit");
  let editingId = null;

  if (!isAdmin && brancaWrap) brancaWrap.remove();

  function fillScopeOptions() {
    if (!scopeSelect) return;
    if (isAdmin) {
      scopeSelect.innerHTML = `
        <option value="gruppo">Gruppo</option>
        <option value="branca">Evento di branca</option>
        <option value="staff">Staff di branca</option>
        <option value="coca">Co.Ca.</option>
      `;
      if (brancaSelect) {
        brancaSelect.innerHTML = Object.values(window.SCOUT_BRANCHES || {})
          .map((b) => `<option value="${b.id}">${escapeHtml(b.label)}</option>`)
          .join("");
      }
    } else {
      const brancaLabel = ScoutStore.branchLabel(user.branca);
      scopeSelect.innerHTML = `
        <option value="gruppo">Gruppo</option>
        <option value="branca">${escapeHtml(brancaLabel)}</option>
        <option value="staff">Staff ${escapeHtml(brancaLabel)}</option>
        <option value="coca">Co.Ca.</option>
      `;
    }
    syncBrancaVisibility();
  }

  function syncBrancaVisibility() {
    if (!isAdmin || !brancaWrap || !scopeSelect) {
      if (brancaWrap) brancaWrap.hidden = true;
      return;
    }
    const needs = scopeSelect.value === "branca" || scopeSelect.value === "staff";
    brancaWrap.hidden = !needs;
    if (brancaSelect) brancaSelect.required = needs;
  }

  scopeSelect?.addEventListener("change", syncBrancaVisibility);

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
      .map((e) => {
        const range = formatEventRange(e);
        return `
        <div class="event-admin-item" data-id="${e.id}">
          <div>
            ${eventBadge(e)}
            <strong style="display:inline-block;margin-left:.35rem">${escapeHtml(e.title)}</strong><br>
            <span style="color:var(--muted)">${escapeHtml(range)}${e.place ? " · " + escapeHtml(e.place) : ""}</span>
          </div>
          <div class="inline-actions">
            <button type="button" class="btn btn-ghost btn-small" data-edit="${e.id}">Modifica</button>
            <button type="button" class="btn btn-ghost btn-small" data-delete="${e.id}">Elimina</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function startEdit(id) {
    const event = ScoutStore.getEvents().find((e) => e.id === id);
    if (!event || !ScoutStore.canManageEvent(user, event)) return;
    fillScopeOptions();
    editingId = id;
    eventForm.title.value = event.title;
    eventForm.dateStart.value = event.dateStart || event.date || "";
    eventForm.dateEnd.value = event.dateEnd || event.dateStart || event.date || "";
    eventForm.time.value = event.allDay ? "" : event.time || "";
    eventForm.place.value = event.place || "";
    eventForm.description.value = event.description || event.notes || "";
    scopeSelect.value = event.scope;
    syncBrancaVisibility();
    if (brancaSelect && event.branca) brancaSelect.value = event.branca;
    if (submitBtn) submitBtn.textContent = "Salva modifiche";
    if (cancelEditBtn) cancelEditBtn.hidden = false;
    eventForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  fillScopeOptions();

  eventForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(eventForm);
    const time = String(data.get("time") || "").trim();
    const payload = {
      title: data.get("title"),
      dateStart: data.get("dateStart"),
      dateEnd: data.get("dateEnd") || data.get("dateStart"),
      allDay: !time,
      time,
      place: data.get("place"),
      description: data.get("description"),
      scope: data.get("scope"),
      branca: isAdmin ? data.get("branca") : user.branca,
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
