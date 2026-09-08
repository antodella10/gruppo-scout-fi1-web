document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "calendari", requireAdmin: true });
  if (!user) return;

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
});
