document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "gestione-sentieri", requireSentieri: true });
  if (!user) return;

  const listEl = document.getElementById("sentieri-list");
  const editor = document.getElementById("sentieri-editor");
  const titleEl = document.getElementById("sentieri-editor-title");
  const classeSelect = document.getElementById("sentieri-classe");
  const specsEl = document.getElementById("sentieri-specs");
  const statusEl = document.getElementById("sentieri-status");
  let selectedId = null;
  let draftSpecs = [];

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

  function renderSpecs() {
    if (!specsEl) return;
    if (!draftSpecs.length) {
      specsEl.innerHTML = `<div class="empty-state">Nessuna specialità.</div>`;
      return;
    }
    specsEl.innerHTML = draftSpecs
      .map(
        (s, i) => `
      <div class="sentieri-spec-row" data-idx="${i}">
        <input type="text" value="${escapeHtml(s.name)}" data-spec-name placeholder="Nome specialità">
        <select data-spec-status>
          <option value="earned" ${s.status === "earned" ? "selected" : ""}>Ottenuta</option>
          <option value="pending" ${s.status === "pending" ? "selected" : ""}>Richiesta</option>
        </select>
        <button type="button" class="btn btn-ghost btn-small" data-spec-del>✕</button>
      </div>`
      )
      .join("");
  }

  function readDraftFromDom() {
    if (!specsEl) return;
    draftSpecs = [...specsEl.querySelectorAll(".sentieri-spec-row")].map((row) => ({
      id: draftSpecs[Number(row.dataset.idx)]?.id || `specprog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: row.querySelector("[data-spec-name]")?.value || "Specialità",
      status: row.querySelector("[data-spec-status]")?.value === "pending" ? "pending" : "earned",
    }));
  }

  function openEditor(ragazzo) {
    selectedId = ragazzo.id;
    if (editor) editor.hidden = false;
    if (titleEl) titleEl.textContent = `${ragazzo.nome} ${ragazzo.cognome}`;
    if (classeSelect) classeSelect.value = ragazzo.classe || "";
    draftSpecs = Array.isArray(ragazzo.specialita)
      ? ragazzo.specialita.map((s) => ({ ...s }))
      : [];
    renderSpecs();
  }

  function refreshList() {
    if (!listEl) return;
    const list = ScoutStore.listRagazziAccounts(user);
    if (!list.length) {
      listEl.innerHTML = `<div class="empty-state">Nessun account repartari.</div>`;
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

  specsEl?.addEventListener("click", (e) => {
    const del = e.target.closest("[data-spec-del]");
    if (!del) return;
    readDraftFromDom();
    const row = del.closest("[data-idx]");
    const i = Number(row?.dataset.idx);
    if (!Number.isFinite(i)) return;
    draftSpecs.splice(i, 1);
    renderSpecs();
  });

  document.getElementById("sentieri-add-spec")?.addEventListener("click", () => {
    readDraftFromDom();
    draftSpecs.push({
      id: `specprog_${Date.now()}`,
      name: "Nuova specialità",
      status: "earned",
    });
    renderSpecs();
  });

  document.getElementById("sentieri-save")?.addEventListener("click", async () => {
    if (!selectedId) return;
    readDraftFromDom();
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
    refreshList();
  })();
});
