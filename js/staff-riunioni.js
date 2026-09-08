document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "riunioni" });
  if (!user) return;
  if (!StaffShell.canMeetings(user)) {
    location.href = "./index.html";
    return;
  }

  const isAdmin = StaffShell.isAdmin(user);
  const hoursHint = document.getElementById("meeting-hours-hint");
  const hoursEditor = document.getElementById("meeting-hours-editor");
  const hoursAlert = document.getElementById("meeting-hours-alert");
  const hoursSave = document.getElementById("meeting-hours-save");
  const DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

  if (hoursHint) {
    hoursHint.textContent = isAdmin
      ? "Lupetti e Reparto, ciascuno su Girone e Quarate."
      : `Orari di ${ScoutStore.branchLabel(user.branca)} (Girone e Quarate).`;
  }

  function renderHoursEditor() {
    if (!hoursEditor) return;
    const hours = ScoutStore.getMeetingHours().filter((h) => ScoutStore.canEditMeetingSlot(user, h));
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
    const rows = [...hoursEditor.querySelectorAll(".meeting-edit-row")].map((row) => ({
      id: row.dataset.id,
      day: row.querySelector('[name="day"]').value,
      time: row.querySelector('[name="time"]').value,
      place: row.querySelector('[name="place"]').value,
    }));
    try {
      ScoutStore.saveMeetingHours(rows, user);
      flashAlert(hoursAlert, "Orari salvati. Compariranno nella home di gruppo.", true);
      renderHoursEditor();
    } catch (err) {
      flashAlert(hoursAlert, err.message || "Salvataggio non riuscito.", false);
    }
  });

  renderHoursEditor();
});
