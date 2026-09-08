document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "richieste", requireAdmin: true });
  if (!user) return;

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

  pendingList?.addEventListener("click", async (e) => {
    const approve = e.target.closest("[data-approve]");
    const reject = e.target.closest("[data-reject]");
    try {
      if (approve) {
        await ScoutStore.approvePending(approve.dataset.approve, user);
        refreshPending();
      }
      if (reject) {
        if (!confirm("Rifiutare questa richiesta?")) return;
        await ScoutStore.rejectPending(reject.dataset.reject, user);
        refreshPending();
      }
    } catch (err) {
      alert(err.message);
    }
  });

  (async () => {
    await ScoutStore.pullRemoteAccounts?.().catch(() => {});
    refreshPending();
  })();
});
