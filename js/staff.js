document.addEventListener("DOMContentLoaded", () => {
  const user = ScoutStore.getCurrentUser();
  if (!user) {
    location.href = "./login.html";
    return;
  }

  const isAdmin = ScoutStore.isAdminUser(user);
  const nameEl = document.getElementById("staff-name");
  const metaEl = document.getElementById("staff-meta");
  if (nameEl) nameEl.textContent = `${user.nome} ${user.cognome}`;
  if (metaEl) {
    metaEl.textContent = isAdmin
      ? "Admin generale · tutte le branche"
      : `Staff ${ScoutStore.branchLabel(user.branca)}`;
  }

  const eventHint = document.getElementById("event-hint");
  if (eventHint && isAdmin) {
    eventHint.textContent =
      "Come admin puoi creare e modificare qualsiasi evento di qualsiasi branca.";
  }

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    ScoutStore.logout();
    location.href = "../index.html";
  });

  const adminPanel = document.getElementById("admin-panel");
  const gcalPanel = document.getElementById("gcal-panel");
  if (adminPanel) adminPanel.hidden = !isAdmin;
  if (gcalPanel) gcalPanel.hidden = !isAdmin;

  // —— Admin: Google Calendar + pending approvals ——
  if (isAdmin) {
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
        try {
          const url = gcalForm.googleEmbed.value.trim();
          ScoutStore.saveSettings({ googleCalendarEmbed: url }, user);
          renderGcal(url);
        } catch (err) {
          alert(err.message);
        }
      });
    }

    const pendingList = document.getElementById("pending-list");
    function refreshPending() {
      if (!pendingList) return;
      const list = ScoutStore.listPending(user);
      if (!list.length) {
        pendingList.innerHTML = `<div class="empty-state">Nessuna richiesta in attesa.</div>`;
        return;
      }
      pendingList.innerHTML = list
        .map(
          (p) => `
          <div class="event-admin-item" data-pending="${p.id}">
            <div>
              <strong>${escapeHtml(p.nome)} ${escapeHtml(p.cognome)}</strong><br>
              <span style="color:var(--muted)">${escapeHtml(p.email)} · ${escapeHtml(ScoutStore.branchLabel(p.branca))}</span>
            </div>
            <div class="inline-actions">
              <button type="button" class="btn btn-primary btn-small" data-approve="${p.id}">Approva</button>
              <button type="button" class="btn btn-ghost btn-small" data-reject="${p.id}">Rifiuta</button>
            </div>
          </div>`
        )
        .join("");
    }

    pendingList?.addEventListener("click", (e) => {
      const approve = e.target.closest("[data-approve]");
      const reject = e.target.closest("[data-reject]");
      try {
        if (approve) {
          ScoutStore.approvePending(approve.dataset.approve, user);
          refreshPending();
        }
        if (reject) {
          if (!confirm("Rifiutare questa richiesta?")) return;
          ScoutStore.rejectPending(reject.dataset.reject, user);
          refreshPending();
        }
      } catch (err) {
        alert(err.message);
      }
    });

    refreshPending();
  }

  // —— Canzoniere (staff reparto + admin) ——
  const czPanel = document.getElementById("reparto-canzoniere-panel");
  const czPreview = document.getElementById("reparto-proposals-preview");
  if (czPanel && typeof CanzoniereStore !== "undefined" && CanzoniereStore.canManage(user)) {
    czPanel.hidden = false;
    const pending = CanzoniereStore.getProposals().filter((p) => p.status === "pending");
    if (czPreview) {
      if (!pending.length) {
        czPreview.innerHTML = `<div class="empty-state">Nessuna proposta canzone in attesa.</div>`;
      } else {
        czPreview.innerHTML = `
          <div class="alert alert-ok" style="margin:0">
            <strong>${pending.length}</strong> proposta/e in attesa —
            <a href="./canzoniere.html" style="color:inherit;font-weight:800;text-decoration:underline">vedile qui</a>
          </div>
          <ul class="proposal-mini">
            ${pending
              .slice(0, 5)
              .map((p) => `<li><strong>${escapeHtml(p.title)}</strong> <span>· ${escapeHtml(p.fromName)}</span></li>`)
              .join("")}
          </ul>`;
      }
    }
  }

  // —— Events ——
  const eventForm = document.getElementById("event-form");
  const eventList = document.getElementById("staff-event-list");
  const eventAlert = document.getElementById("event-alert");
  const scopeSelect = document.getElementById("event-scope");
  const brancaWrap = document.getElementById("event-branca-wrap");
  const brancaSelect = document.getElementById("event-branca");
  const submitBtn = document.getElementById("event-submit");
  const cancelEditBtn = document.getElementById("cancel-edit");
  let editingId = null;

  function fillScopeOptions() {
    if (!scopeSelect) return;
    if (isAdmin) {
      scopeSelect.innerHTML = `
        <option value="gruppo">Gruppo</option>
        <option value="branca">Branca</option>
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
    if (!brancaWrap || !scopeSelect) return;
    const needs = isAdmin && (scopeSelect.value === "branca" || scopeSelect.value === "staff");
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
    const payload = {
      title: data.get("title"),
      date: data.get("date"),
      time: data.get("time"),
      place: data.get("place"),
      notes: data.get("notes"),
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
