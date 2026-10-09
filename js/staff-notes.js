document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "note-punteggi" });
  if (!user) return;

  const alertBox = document.getElementById("notes-alert");
  const tabsEl = document.getElementById("notes-branch-tabs");
  const titleEl = document.getElementById("notes-branch-title");
  const hintEl = document.getElementById("notes-branch-hint");
  const textEl = document.getElementById("notes-text");
  const updatedEl = document.getElementById("notes-updated");
  const sheetUrlEl = document.getElementById("notes-sheet-url");
  const sheetOpen = document.getElementById("notes-sheet-open");
  const saveNotesBtn = document.getElementById("notes-save");
  const saveSheetBtn = document.getElementById("notes-sheet-save");

  const isAdmin = ScoutStore.isAdminUser(user);
  const branches = Object.keys(window.SCOUT_BRANCHES || {});
  let activeBranca = isAdmin ? branches[0] || "riparto" : user.branca;

  if (!activeBranca) {
    flashAlert(alertBox, "Il tuo account non ha una branca assegnata.", false);
    return;
  }

  function flash(msg, ok = true) {
    flashAlert(alertBox, msg, ok);
  }

  function formatUpdated(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function paint() {
    const row = ScoutStore.getBranchNotes(activeBranca);
    const label = ScoutStore.branchLabel?.(activeBranca) || activeBranca;
    if (titleEl) titleEl.textContent = `Note · ${label}`;
    if (hintEl) {
      hintEl.textContent = isAdmin
        ? "Vista admin: puoi leggere e modificare le note di ogni branca."
        : `Condivise in tempo reale con lo staff ${label}.`;
    }
    if (textEl) textEl.value = row.text || "";
    if (sheetUrlEl) sheetUrlEl.value = row.sheetUrl || "";
    if (updatedEl) {
      const when = formatUpdated(row.updatedAt);
      updatedEl.hidden = !when;
      updatedEl.textContent = when ? `Ultimo aggiornamento: ${when}` : "";
    }
    if (sheetOpen) {
      if (row.sheetUrl) {
        sheetOpen.hidden = false;
        sheetOpen.href = row.sheetUrl;
      } else {
        sheetOpen.hidden = true;
        sheetOpen.removeAttribute("href");
      }
    }
    tabsEl?.querySelectorAll("[data-notes-branca]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.notesBranca === activeBranca);
    });
  }

  function renderTabs() {
    if (!tabsEl || !isAdmin) {
      if (tabsEl) tabsEl.hidden = true;
      return;
    }
    tabsEl.hidden = false;
    tabsEl.innerHTML = branches
      .map(
        (b) => `
      <button type="button" class="notes-tab ${b === activeBranca ? "is-active" : ""}" data-notes-branca="${escapeHtml(b)}">
        ${escapeHtml(ScoutStore.branchLabel?.(b) || b)}
      </button>`
      )
      .join("");
  }

  tabsEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-notes-branca]");
    if (!btn) return;
    activeBranca = btn.dataset.notesBranca;
    paint();
  });

  saveNotesBtn?.addEventListener("click", () => {
    try {
      const current = ScoutStore.getBranchNotes(activeBranca);
      ScoutStore.saveBranchNotes(
        activeBranca,
        { text: textEl?.value || "", sheetUrl: current.sheetUrl },
        user
      );
      flash("Note salvate.");
      paint();
    } catch (err) {
      flash(err.message || "Salvataggio fallito.", false);
    }
  });

  saveSheetBtn?.addEventListener("click", () => {
    try {
      const current = ScoutStore.getBranchNotes(activeBranca);
      ScoutStore.saveBranchNotes(
        activeBranca,
        { text: current.text, sheetUrl: sheetUrlEl?.value || "" },
        user
      );
      flash("Link foglio salvato.");
      paint();
    } catch (err) {
      flash(err.message || "Salvataggio fallito.", false);
    }
  });

  renderTabs();
  paint();

  ScoutStore.pullRemoteSettings?.()
    .then(() => paint())
    .catch(() => {});

  // Soft polling per note “in tempo reale” tra dispositivi
  window.setInterval(() => {
    ScoutStore.pullRemoteSettings?.()
      .then(() => {
        if (document.activeElement === textEl || document.activeElement === sheetUrlEl) return;
        paint();
      })
      .catch(() => {});
  }, 20_000);
});
