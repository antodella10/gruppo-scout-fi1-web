document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "richieste", requireAdmin: true });
  if (!user) return;

  const pendingList = document.getElementById("pending-list");
  const accountsList = document.getElementById("accounts-list");

  function formatDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }

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

  function refreshAccounts() {
    if (!accountsList) return;
    const list = ScoutStore.listStaffAccounts(user);
    if (!list.length) {
      accountsList.innerHTML = `<div class="empty-state">Nessun account staff.</div>`;
      return;
    }
    accountsList.innerHTML = list
      .map((a) => {
        const role = a.isAdmin
          ? "Admin"
          : ScoutStore.branchLabel(a.branca) || "Staff";
        const when = formatDate(a.approvedAt || a.createdAt);
        const canDelete = !a.isAdmin && a.id !== user.id;
        return `
        <div class="event-admin-item" data-account="${escapeHtml(a.id)}">
          <div>
            <strong>${escapeHtml(a.nome)} ${escapeHtml(a.cognome)}</strong>
            ${a.isAdmin ? `<span class="badge badge-branca" style="margin-left:.35rem">Admin</span>` : ""}
            <br>
            <span style="color:var(--muted)">${escapeHtml(a.email)} · ${escapeHtml(role)}${
              when ? ` · dal ${escapeHtml(when)}` : ""
            }</span>
          </div>
          <div class="inline-actions">
            ${
              canDelete
                ? `<button type="button" class="btn btn-ghost btn-small" data-del-account="${escapeHtml(a.id)}">Elimina</button>`
                : `<span class="hint">${a.isAdmin ? "Protetto" : "Tu"}</span>`
            }
          </div>
        </div>`;
      })
      .join("");
  }

  function refreshAll() {
    refreshPending();
    refreshAccounts();
  }

  pendingList?.addEventListener("click", async (e) => {
    const approve = e.target.closest("[data-approve]");
    const reject = e.target.closest("[data-reject]");
    try {
      if (approve) {
        await ScoutStore.approvePending(approve.dataset.approve, user);
        refreshAll();
      }
      if (reject) {
        if (!confirm("Rifiutare questa richiesta?")) return;
        await ScoutStore.rejectPending(reject.dataset.reject, user);
        refreshAll();
      }
    } catch (err) {
      alert(err.message);
    }
  });

  accountsList?.addEventListener("click", async (e) => {
    const del = e.target.closest("[data-del-account]");
    if (!del) return;
    const id = del.dataset.delAccount;
    const account = ScoutStore.listStaffAccounts(user).find((a) => a.id === id);
    const label = account
      ? `${account.nome} ${account.cognome} (${account.email})`
      : "questo account";
    if (!confirm(`Eliminare ${label}? Non potrà più accedere all’area staff.`)) return;
    try {
      await ScoutStore.deleteStaffAccount(id, user);
      refreshAll();
    } catch (err) {
      alert(err.message);
    }
  });

  (async () => {
    await ScoutStore.pullRemoteAccounts?.().catch(() => {});
    refreshAll();
  })();
});
