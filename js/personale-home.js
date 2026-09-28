document.addEventListener("DOMContentLoaded", () => {
  const user = PersonaleShell.boot({ active: "home" });
  if (!user) return;

  const head = document.getElementById("personale-head");
  const classiEl = document.getElementById("personale-classi");
  const specsEl = document.getElementById("personale-specialita");

  function renderHead() {
    if (!head) return;
    head.innerHTML = `
      <div class="personale-identity">
        <div class="personale-identity-text">
          <h1 class="personale-name">${escapeHtml(user.nome)} ${escapeHtml(user.cognome)}</h1>
          <p class="personale-squad">${escapeHtml(user.squadriglia || "Squadriglia")}</p>
        </div>
        <div class="personale-squad-icon" aria-hidden="true" title="Icona squadriglia (placeholder)">
          <span>SQ</span>
        </div>
      </div>
    `;
  }

  function renderClassi() {
    if (!classiEl) return;
    const progress = ScoutStore.getRagazzoProgress(user);
    const obtained = ScoutStore.classiOttenuteDisplay(progress.classe);
    if (!obtained.length) {
      classiEl.innerHTML = "";
      return;
    }
    classiEl.innerHTML = `
      <div class="classi-track" role="list">
        ${obtained
          .map(
            (c) => `
          <div class="classe-badge ${c.isLatest ? `is-latest glow-${escapeHtml(c.glow)}` : ""}" role="listitem" data-classe="${escapeHtml(c.id)}">
            <span class="classe-badge-icon" aria-hidden="true"></span>
            <span class="classe-badge-label">${escapeHtml(c.label)}</span>
          </div>`
          )
          .join("")}
      </div>
    `;
  }

  function renderSpecialita() {
    if (!specsEl) return;
    const progress = ScoutStore.getRagazzoProgress(user);
    const list = progress.specialita || [];
    if (!list.length) {
      specsEl.innerHTML = `<p class="hint" style="margin:0">Le specialità ottenute e richieste compariranno qui.</p>`;
      return;
    }
    specsEl.innerHTML = `
      <div class="spec-progress-row" role="list">
        ${list
          .map(
            (s) => `
          <div class="spec-progress-item ${s.status === "pending" ? "is-pending" : "is-earned"}" role="listitem" title="${escapeHtml(s.name)}">
            <span class="spec-progress-icon" aria-hidden="true"></span>
            <span class="spec-progress-name">${escapeHtml(s.name)}</span>
          </div>`
          )
          .join("")}
      </div>
    `;
  }

  (async () => {
    await ScoutStore.pullRemoteAccounts?.().catch(() => {});
    const fresh = ScoutStore.getCurrentUser() || user;
    Object.assign(user, fresh);
    renderHead();
    renderClassi();
    renderSpecialita();
  })();
});
