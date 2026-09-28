document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "richieste", requireAccountRequests: true });
  if (!user) return;

  const canStaff = ScoutStore.canManageStaffRequests(user);
  const canRagazzi = ScoutStore.canManageRagazziRequests(user);

  const pendingStaffList = document.getElementById("pending-staff-list");
  const accountsStaffList = document.getElementById("accounts-staff-list");
  const pendingRagazziList = document.getElementById("pending-ragazzi-list");
  const accountsRagazziList = document.getElementById("accounts-ragazzi-list");

  document.getElementById("section-staff").hidden = !canStaff;
  document.getElementById("section-ragazzi").hidden = !canRagazzi;
  document.getElementById("section-staff")?.classList.toggle("is-hidden", !canStaff);
  document.getElementById("section-ragazzi")?.classList.toggle("is-hidden", !canRagazzi);
  document
    .querySelector(".account-requests-grid")
    ?.classList.toggle("is-single", !(canStaff && canRagazzi));

  const statusEl = document.getElementById("richieste-status");

  function showStatus(msg, kind = "ok") {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.className = `alert alert-${kind === "error" ? "error" : "ok"}`;
    statusEl.textContent = msg;
    statusEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

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

  function formatBirth(iso) {
    if (!iso) return "";
    try {
      return new Date(iso + "T12:00:00").toLocaleDateString("it-IT");
    } catch {
      return iso;
    }
  }

  function refreshPendingStaff() {
    if (!pendingStaffList || !canStaff) return;
    const list = ScoutStore.listPendingStaff(user);
    if (!list.length) {
      pendingStaffList.innerHTML = `<div class="empty-state">Nessuna richiesta staff in attesa.</div>`;
      return;
    }
    pendingStaffList.innerHTML = list
      .map(
        (p) => `
        <div class="event-admin-item" data-pending="${p.id}">
          <div>
            <strong>${escapeHtml(p.nome)} ${escapeHtml(p.cognome)}</strong><br>
            <span style="color:var(--muted)">${escapeHtml(p.email)} · ${escapeHtml(ScoutStore.branchLabel(p.branca))}${
              p.dataNascita ? ` · nato/a ${escapeHtml(formatBirth(p.dataNascita))}` : ""
            }</span>
          </div>
          <div class="inline-actions">
            <button type="button" class="btn btn-primary btn-small" data-approve="${p.id}">Approva</button>
            <button type="button" class="btn btn-ghost btn-small" data-reject="${p.id}">Rifiuta</button>
          </div>
        </div>`
      )
      .join("");
  }

  function refreshAccountsStaff() {
    if (!accountsStaffList || !canStaff) return;
    const list = ScoutStore.listStaffAccounts(user);
    if (!list.length) {
      accountsStaffList.innerHTML = `<div class="empty-state">Nessun account staff.</div>`;
      return;
    }
    accountsStaffList.innerHTML = list
      .map((a) => {
        const role = a.isAdmin ? "Admin" : ScoutStore.branchLabel(a.branca) || "Staff";
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
                ? `<button type="button" class="btn btn-ghost btn-small" data-del-staff="${escapeHtml(a.id)}">Elimina</button>`
                : `<span class="hint">${a.isAdmin ? "Protetto" : "Tu"}</span>`
            }
          </div>
        </div>`;
      })
      .join("");
  }

  function refreshPendingRagazzi() {
    if (!pendingRagazziList || !canRagazzi) return;
    const list = ScoutStore.listPendingRagazzi(user);
    if (!list.length) {
      pendingRagazziList.innerHTML = `<div class="empty-state">Nessuna richiesta repartari in attesa.</div>`;
      return;
    }
    pendingRagazziList.innerHTML = list
      .map(
        (p) => `
        <div class="event-admin-item" data-pending="${p.id}">
          <div>
            <strong>${escapeHtml(p.nome)} ${escapeHtml(p.cognome)}</strong><br>
            <span style="color:var(--muted)">
              ${escapeHtml(p.email)} · Sq. ${escapeHtml(p.squadriglia || "—")}
              ${p.dataNascita ? ` · nato/a ${escapeHtml(formatBirth(p.dataNascita))}` : ""}
            </span>
          </div>
          <div class="inline-actions">
            <button type="button" class="btn btn-primary btn-small" data-approve="${p.id}">Approva</button>
            <button type="button" class="btn btn-ghost btn-small" data-reject="${p.id}">Rifiuta</button>
          </div>
        </div>`
      )
      .join("");
  }

  function refreshAccountsRagazzi() {
    if (!accountsRagazziList || !canRagazzi) return;
    const list = ScoutStore.listRagazziAccounts(user);
    if (!list.length) {
      accountsRagazziList.innerHTML = `<div class="empty-state">Nessun account repartari.</div>`;
      return;
    }
    accountsRagazziList.innerHTML = list
      .map((a) => {
        const when = formatDate(a.approvedAt || a.createdAt);
        return `
        <div class="event-admin-item" data-account="${escapeHtml(a.id)}">
          <div>
            <strong>${escapeHtml(a.nome)} ${escapeHtml(a.cognome)}</strong><br>
            <span style="color:var(--muted)">
              ${escapeHtml(a.email)} · Sq. ${escapeHtml(a.squadriglia || "—")}
              ${a.dataNascita ? ` · ${escapeHtml(formatBirth(a.dataNascita))}` : ""}
              ${when ? ` · dal ${escapeHtml(when)}` : ""}
            </span>
          </div>
          <div class="inline-actions">
            <button type="button" class="btn btn-ghost btn-small" data-del-ragazzo="${escapeHtml(a.id)}">Elimina</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function refreshAll() {
    refreshPendingStaff();
    refreshAccountsStaff();
    refreshPendingRagazzi();
    refreshAccountsRagazzi();
  }

  document.querySelector(".staff-shell")?.addEventListener("click", async (e) => {
    const approve = e.target.closest("[data-approve]");
    const reject = e.target.closest("[data-reject]");
    const delStaff = e.target.closest("[data-del-staff]");
    const delRagazzo = e.target.closest("[data-del-ragazzo]");
    try {
      if (approve) {
        const result = await ScoutStore.approvePending(approve.dataset.approve, user);
        refreshAll();
        if (typeof StaffNotifs !== "undefined") {
          StaffNotifs.pullAll().then(() => StaffShell.applyMenuBadges(user));
        }
        const mail = result?.emailNotify;
        if (mail?.sent) {
          showStatus("Account approvato. Email di conferma inviata.");
        } else if (mail?.skipped) {
          showStatus("Account approvato. Email automatica non configurata: avvisa tu la persona.");
        } else if (mail?.error) {
          showStatus(`Account approvato, ma l’email non è partita: ${mail.error}`, "error");
        } else {
          showStatus("Account approvato.");
        }
      }
      if (reject) {
        if (!confirm("Rifiutare questa richiesta?")) return;
        await ScoutStore.rejectPending(reject.dataset.reject, user);
        refreshAll();
        showStatus("Richiesta rifiutata.");
      }
      if (delStaff) {
        const id = delStaff.dataset.delStaff;
        const account = ScoutStore.listStaffAccounts(user).find((a) => a.id === id);
        const label = account
          ? `${account.nome} ${account.cognome} (${account.email})`
          : "questo account";
        if (!confirm(`Eliminare ${label}? Non potrà più accedere all’area staff.`)) return;
        await ScoutStore.deleteStaffAccount(id, user);
        refreshAll();
      }
      if (delRagazzo) {
        const id = delRagazzo.dataset.delRagazzo;
        const account = ScoutStore.listRagazziAccounts(user).find((a) => a.id === id);
        const label = account
          ? `${account.nome} ${account.cognome} (${account.email})`
          : "questo account";
        if (!confirm(`Eliminare ${label}? Non potrà più aprire i file del Sentiero.`)) return;
        await ScoutStore.deleteRagazzoAccount(id, user);
        refreshAll();
      }
    } catch (err) {
      alert(err.message);
    }
  });

  (async () => {
    await ScoutStore.pullRemoteAccounts?.().catch(() => {});
    refreshAll();
  })();
});
