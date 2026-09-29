document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "gestione-sentieri", requireSentieri: true });
  if (!user) return;

  const listEl = document.getElementById("sentieri-list");
  const editor = document.getElementById("sentieri-editor");
  const titleEl = document.getElementById("sentieri-editor-title");
  const classeSelect = document.getElementById("sentieri-classe");
  const classeHint = document.getElementById("sentieri-classe-hint");
  const specsEl = document.getElementById("sentieri-specs");
  const searchEl = document.getElementById("sentieri-spec-search");
  const catalogEl = document.getElementById("sentieri-spec-catalog");
  const statusEl = document.getElementById("sentieri-status");

  let selectedId = null;
  let draftSpecs = [];
  let catalog = [];

  (ScoutStore.CLASSI_SENTIERO || []).forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.label;
    classeSelect?.appendChild(opt);
  });

  function showStatus(msg, kind = "ok") {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.className = `alert alert-${kind === "error" ? "error" : "ok"}`;
    statusEl.textContent = msg;
  }

  function includedClassesLabel(classeId) {
    const obtained = ScoutStore.classiOttenuteDisplay(classeId);
    if (!obtained.length) return "Nessuna classe inclusa.";
    const names = obtained
      .slice()
      .reverse()
      .map((c) => c.label)
      .join(" → ");
    return `Include automaticamente: ${names}`;
  }

  function updateClasseHint() {
    if (!classeHint) return;
    classeHint.textContent = includedClassesLabel(classeSelect?.value || "");
  }

  function renderAssignedSpecs() {
    if (!specsEl) return;
    if (!draftSpecs.length) {
      specsEl.innerHTML = `<div class="empty-state">Nessuna specialità assegnata.</div>`;
      return;
    }
    specsEl.innerHTML = draftSpecs
      .map(
        (s, i) => `
      <div class="sentieri-spec-row" data-idx="${i}">
        <strong class="sentieri-spec-name">${escapeHtml(s.name)}</strong>
        <select data-spec-status>
          <option value="earned" ${s.status === "earned" ? "selected" : ""}>Ottenuta</option>
          <option value="pending" ${s.status === "pending" ? "selected" : ""}>Richiesta</option>
        </select>
        <button type="button" class="btn btn-ghost btn-small" data-spec-del>✕</button>
      </div>`
      )
      .join("");
  }

  function readStatusesFromDom() {
    if (!specsEl) return;
    [...specsEl.querySelectorAll(".sentieri-spec-row")].forEach((row) => {
      const i = Number(row.dataset.idx);
      if (!Number.isFinite(i) || !draftSpecs[i]) return;
      draftSpecs[i].status =
        row.querySelector("[data-spec-status]")?.value === "pending" ? "pending" : "earned";
    });
  }

  function renderCatalog() {
    if (!catalogEl) return;
    const q = String(searchEl?.value || "")
      .trim()
      .toLowerCase();
    const assigned = new Set(draftSpecs.map((s) => s.id));
    const filtered = catalog.filter((s) => {
      if (assigned.has(s.id)) return false;
      if (!q) return true;
      return String(s.name || "")
        .toLowerCase()
        .includes(q);
    });

    if (!catalog.length) {
      catalogEl.innerHTML = `<div class="empty-state">Database specialità vuoto. Caricale in Sentiero / specialità.</div>`;
      return;
    }
    if (!filtered.length) {
      catalogEl.innerHTML = `<div class="empty-state">Nessun risultato.</div>`;
      return;
    }

    catalogEl.innerHTML = filtered
      .slice(0, 40)
      .map(
        (s) => `
      <div class="sentieri-catalog-item">
        <span>${escapeHtml(s.name)}</span>
        <span class="inline-actions">
          <button type="button" class="btn btn-primary btn-small" data-add-spec="${escapeHtml(s.id)}" data-status="earned">Ottenuta</button>
          <button type="button" class="btn btn-ghost btn-small" data-add-spec="${escapeHtml(s.id)}" data-status="pending">Richiesta</button>
        </span>
      </div>`
      )
      .join("");
  }

  function openEditor(ragazzo) {
    selectedId = ragazzo.id;
    if (editor) editor.hidden = false;
    if (titleEl) titleEl.textContent = `${ragazzo.nome} ${ragazzo.cognome}`;
    if (classeSelect) classeSelect.value = ragazzo.classe || "";
    draftSpecs = Array.isArray(ragazzo.specialita)
      ? ragazzo.specialita.map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status === "pending" ? "pending" : "earned",
        }))
      : [];
    updateClasseHint();
    renderAssignedSpecs();
    renderCatalog();
  }

  function refreshList() {
    if (!listEl) return;
    const list = ScoutStore.listRagazziAccounts(user);
    if (!list.length) {
      listEl.innerHTML = `<div class="empty-state">Nessun account Ripartari.</div>`;
      return;
    }
    listEl.innerHTML = list
      .map((r) => {
        const classeLabel =
          (ScoutStore.CLASSI_SENTIERO || []).find((c) => c.id === r.classe)?.label || "—";
        const nSpec = (r.specialita || []).filter((s) => s.status === "earned").length;
        return `
        <button type="button" class="event-admin-item sentieri-pick ${selectedId === r.id ? "is-active" : ""}" data-id="${escapeHtml(r.id)}">
          <div>
            <strong>${escapeHtml(r.nome)} ${escapeHtml(r.cognome)}</strong><br>
            <span style="color:var(--muted)">Sq. ${escapeHtml(r.squadriglia || "—")} · ${escapeHtml(classeLabel)} · ${nSpec} spec.</span>
          </div>
        </button>`;
      })
      .join("");
  }

  listEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-id]");
    if (!btn) return;
    const ragazzo = ScoutStore.listRagazziAccounts(user).find((r) => r.id === btn.dataset.id);
    if (ragazzo) openEditor(ragazzo);
    refreshList();
  });

  classeSelect?.addEventListener("change", updateClasseHint);

  specsEl?.addEventListener("click", (e) => {
    const del = e.target.closest("[data-spec-del]");
    if (!del) return;
    readStatusesFromDom();
    const row = del.closest("[data-idx]");
    const i = Number(row?.dataset.idx);
    if (!Number.isFinite(i)) return;
    draftSpecs.splice(i, 1);
    renderAssignedSpecs();
    renderCatalog();
  });

  catalogEl?.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add-spec]");
    if (!add) return;
    const id = add.dataset.addSpec;
    const item = catalog.find((s) => s.id === id);
    if (!item) return;
    if (draftSpecs.some((s) => s.id === id)) return;
    readStatusesFromDom();
    draftSpecs.push({
      id: item.id,
      name: item.name,
      status: add.dataset.status === "pending" ? "pending" : "earned",
    });
    draftSpecs.sort((a, b) => a.name.localeCompare(b.name, "it"));
    renderAssignedSpecs();
    renderCatalog();
  });

  searchEl?.addEventListener("input", () => renderCatalog());

  document.getElementById("sentieri-save")?.addEventListener("click", async () => {
    if (!selectedId) return;
    readStatusesFromDom();
    try {
      await ScoutStore.updateRagazzoProgress(
        selectedId,
        {
          classe: classeSelect?.value || null,
          specialita: draftSpecs,
        },
        user
      );
      showStatus("Percorso aggiornato.");
      refreshList();
      const ragazzo = ScoutStore.listRagazziAccounts(user).find((r) => r.id === selectedId);
      if (ragazzo) openEditor(ragazzo);
    } catch (err) {
      showStatus(err.message || "Salvataggio non riuscito.", "error");
    }
  });

  (async () => {
    await ScoutStore.pullRemoteAccounts?.().catch(() => {});
    try {
      await SentieroStore.ensureMeta?.();
      catalog = await SentieroStore.getSpecialita();
    } catch {
      catalog = [];
    }
    refreshList();
  })();
});
