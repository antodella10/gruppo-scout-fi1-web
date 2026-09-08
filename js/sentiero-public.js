document.addEventListener("DOMContentLoaded", () => {
  BranchView.persist("reparto", { updateUrl: false });

  const libEmpty = document.getElementById("libretto-empty");
  const libOpen = document.getElementById("libretto-open");
  const specGrid = document.getElementById("spec-grid");
  const specCount = document.getElementById("spec-count");

  let libretto = null;

  async function renderLibretto() {
    libretto = await SentieroStore.getLibretto();
    if (!libretto) {
      if (libEmpty) libEmpty.hidden = false;
      if (libOpen) libOpen.hidden = true;
      return;
    }
    if (libEmpty) libEmpty.hidden = true;
    if (libOpen) libOpen.hidden = false;
  }

  async function renderSpecs() {
    if (!specGrid) return;
    const list = await SentieroStore.getSpecialita();
    if (specCount) {
      specCount.textContent = list.length
        ? `${list.length} specialità in ordine alfabetico.`
        : "Nessuna specialità caricata.";
    }
    if (!list.length) {
      specGrid.innerHTML = `<div class="empty-state">Nessuna specialità disponibile.</div>`;
      return;
    }

    specGrid.innerHTML = list
      .map(
        (s) => `
      <button type="button" class="spec-card" data-id="${escapeHtml(s.id)}">
        <span class="spec-card-media" data-img="${escapeHtml(s.id)}">
          <span class="spec-card-placeholder">★</span>
        </span>
        <span class="spec-card-name">${escapeHtml(s.name)}</span>
      </button>`
      )
      .join("");

    await Promise.all(
      list.map(async (s) => {
        const media = specGrid.querySelector(`[data-img="${CSS.escape(s.id)}"]`);
        if (!media) return;
        try {
          const src = await SentieroStore.resolveImageUrl(s);
          if (src) media.innerHTML = `<img src="${src}" alt="">`;
        } catch {
          /* keep placeholder */
        }
      })
    );
  }

  libOpen?.addEventListener("click", async () => {
    try {
      const item = libretto || (await SentieroStore.getLibretto());
      await SentieroStore.openPdf(item);
    } catch (err) {
      alert(err.message || "Impossibile aprire il libretto.");
    }
  });

  specGrid?.addEventListener("click", async (e) => {
    const card = e.target.closest("[data-id]");
    if (!card) return;
    try {
      const list = await SentieroStore.getSpecialita();
      const item = list.find((x) => x.id === card.dataset.id);
      await SentieroStore.openPdf(item);
    } catch (err) {
      alert(err.message || "Impossibile aprire il PDF.");
    }
  });

  (async () => {
    await SentieroStore.ensureMeta();
    await renderLibretto();
    await renderSpecs();
  })().catch((err) => {
    if (specGrid) {
      specGrid.innerHTML = `<div class="empty-state">${escapeHtml(err.message || "Errore di caricamento")}</div>`;
    }
  });
});
