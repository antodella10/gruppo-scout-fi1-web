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
  if (eventHint) {
    eventHint.textContent = isAdmin
      ? "Come admin puoi creare e modificare qualsiasi evento di qualsiasi branca."
      : `Puoi creare eventi Gruppo, ${ScoutStore.branchLabel(user.branca)}, Staff ${ScoutStore.branchLabel(user.branca)} e Co.Ca.`;
  }

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    ScoutStore.logout();
    location.href = "../index.html";
  });

  const adminPanel = document.getElementById("admin-panel");
  const gcalPanel = document.getElementById("gcal-panel");
  const socialPanel = document.getElementById("social-panel");
  if (adminPanel) adminPanel.hidden = !isAdmin;
  if (gcalPanel) gcalPanel.hidden = !isAdmin;
  if (socialPanel) socialPanel.hidden = !isAdmin;

  // —— Orario riunioni ——
  const hoursPanel = document.getElementById("meeting-hours-panel");
  const hoursEditor = document.getElementById("meeting-hours-editor");
  const hoursHint = document.getElementById("meeting-hours-hint");
  const hoursAlert = document.getElementById("meeting-hours-alert");
  const hoursSave = document.getElementById("meeting-hours-save");
  const DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

  const editableHours = ScoutStore.getMeetingHours().filter((h) =>
    ScoutStore.canEditMeetingSlot(user, h)
  );
  if (hoursPanel) hoursPanel.hidden = editableHours.length === 0;

  if (hoursHint) {
    hoursHint.textContent = isAdmin
      ? "Lupetti e Reparto (Girone / Quarate)."
      : `Orari modificabili per ${ScoutStore.branchLabel(user.branca)}.`;
  }

  function renderHoursEditor() {
    if (!hoursEditor) return;
    const hours = ScoutStore.getMeetingHours().filter((h) => ScoutStore.canEditMeetingSlot(user, h));
    if (!hours.length) {
      hoursEditor.innerHTML = `<div class="empty-state">Nessun orario da gestire per il tuo account.</div>`;
      return;
    }
    hoursEditor.innerHTML = hours
      .map((h) => {
        const dayOpts = [
          `<option value="" ${!h.day ? "selected" : ""}>—</option>`,
          ...DAYS.map((d) => `<option value="${d}" ${h.day === d ? "selected" : ""}>${d}</option>`),
        ].join("");
        return `
        <div class="meeting-edit-row" data-id="${escapeHtml(h.id)}">
          <strong class="mh-edit-label">${escapeHtml(h.label)}</strong>
          <label>Giorno
            <select name="day">${dayOpts}</select>
          </label>
          <label>Orario
            <input type="text" name="time" value="${escapeHtml(h.time)}" placeholder="es. 15:30–17:30">
          </label>
          <label>Luogo
            <input type="text" name="place" value="${escapeHtml(h.place)}" placeholder="Girone / Quarate">
          </label>
        </div>`;
      })
      .join("");
  }

  hoursSave?.addEventListener("click", () => {
    if (!hoursEditor) return;
    const rows = [...hoursEditor.querySelectorAll(".meeting-edit-row")].map((row) => ({
      id: row.dataset.id,
      day: row.querySelector('[name="day"]').value,
      time: row.querySelector('[name="time"]').value,
      place: row.querySelector('[name="place"]').value,
    }));
    try {
      ScoutStore.saveMeetingHours(rows, user);
      if (hoursAlert) {
        hoursAlert.hidden = false;
        hoursAlert.className = "alert alert-ok";
        hoursAlert.textContent = "Orari salvati. Compariranno nella home di gruppo.";
      }
      renderHoursEditor();
    } catch (err) {
      if (hoursAlert) {
        hoursAlert.hidden = false;
        hoursAlert.className = "alert alert-error";
        hoursAlert.textContent = err.message || "Salvataggio non riuscito.";
      }
    }
  });

  renderHoursEditor();

  // —— Admin: social links ——
  if (isAdmin) {
    const socialForm = document.getElementById("social-form");
    const socialAlert = document.getElementById("social-alert");
    const currentSocial = ScoutStore.getSocialLinks();
    if (socialForm) {
      socialForm.facebook.value = currentSocial.facebook || "";
      socialForm.igGruppo.value = currentSocial.instagram.gruppo || "";
      socialForm.igLupetti.value = currentSocial.instagram.lupetti || "";
      socialForm.igReparto.value = currentSocial.instagram.reparto || "";
      socialForm.igNoviziato.value = currentSocial.instagram.noviziato || "";
      socialForm.igClan.value = currentSocial.instagram.clan || "";
    }
    socialForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(socialForm);
      try {
        ScoutStore.saveSocialLinks(
          {
            facebook: data.get("facebook"),
            instagram: {
              gruppo: data.get("igGruppo"),
              lupetti: data.get("igLupetti"),
              reparto: data.get("igReparto"),
              noviziato: data.get("igNoviziato"),
              clan: data.get("igClan"),
            },
          },
          user
        );
        if (socialAlert) {
          socialAlert.hidden = false;
          socialAlert.className = "alert alert-ok";
          socialAlert.textContent = "Link social aggiornati.";
        }
      } catch (err) {
        if (socialAlert) {
          socialAlert.hidden = false;
          socialAlert.className = "alert alert-error";
          socialAlert.textContent = err.message || "Salvataggio non riuscito.";
        }
      }
    });
  }

  // —— Admin: Google Calendar + pending approvals ——
  if (isAdmin) {
    const gcalForm = document.getElementById("gcal-form");
    const gcalList = document.getElementById("gcal-list");

    function refreshGcalList() {
      if (!gcalList) return;
      const list = ScoutStore.listGoogleCalendars();
      if (!list.length) {
        gcalList.innerHTML = `<div class="placeholder-box">Nessun calendario Google collegato.</div>`;
        return;
      }
      gcalList.innerHTML = list
        .map((c) => {
          const label = c.branca === "gruppo" ? "Gruppo" : ScoutStore.branchLabel(c.branca);
          return `
          <div class="event-admin-item">
            <div>
              <strong>${escapeHtml(label)}</strong><br>
              <span style="color:var(--muted);font-size:.85rem;word-break:break-all">${escapeHtml(c.calendarId || c.embedUrl)}</span>
            </div>
            <button type="button" class="btn btn-ghost btn-small" data-del-gcal="${c.id}">Rimuovi</button>
          </div>`;
        })
        .join("");
    }

    gcalForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(gcalForm);
      try {
        ScoutStore.addGoogleCalendar(
          { branca: data.get("gcalBranca"), embedUrl: data.get("googleEmbed") },
          user
        );
        gcalForm.reset();
        refreshGcalList();
      } catch (err) {
        alert(err.message);
      }
    });

    gcalList?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-del-gcal]");
      if (!btn) return;
      if (!confirm("Rimuovere questo calendario Google?")) return;
      try {
        ScoutStore.removeGoogleCalendar(btn.dataset.delGcal, user);
        refreshGcalList();
      } catch (err) {
        alert(err.message);
      }
    });

    refreshGcalList();

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

  const staffSide = document.querySelector(".staff-side");
  const staffMain = document.querySelector(".staff-main");
  if (staffSide) {
    const hasVisible = [...staffSide.children].some((el) => !el.hidden);
    staffSide.hidden = !hasVisible;
    if (!hasVisible && staffMain) staffMain.classList.add("wide");
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

  // Staff generico: niente campo/tendina "Branca"
  if (!isAdmin && brancaWrap) {
    brancaWrap.remove();
  }

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
      // Niente "Branca": tipi con il nome della propria branca
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
