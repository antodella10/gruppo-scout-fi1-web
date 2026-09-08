document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "iscrizioni", requireAdmin: true });
  if (!user) return;

  const form = document.getElementById("iscrizioni-form");
  const alertBox = document.getElementById("iscrizioni-alert");
  const currentEl = document.getElementById("iscrizioni-current");
  const openBtn = document.getElementById("iscrizioni-open");

  function flash(msg, ok = true) {
    flashAlert(alertBox, msg, ok);
  }

  function refresh() {
    const url = ScoutStore.getIscrizioniFormUrl();
    if (form) form.url.value = url || "";
    if (currentEl) {
      currentEl.textContent = url ? `Attuale: ${url}` : "Nessun link impostato.";
    }
    if (openBtn) {
      if (url) {
        openBtn.href = url;
        openBtn.hidden = false;
      } else {
        openBtn.hidden = true;
      }
    }
  }

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      ScoutStore.saveIscrizioniFormUrl(form.url.value, user);
      flash("Link form aggiornato.");
      refresh();
    } catch (err) {
      flash(err.message || "Salvataggio non riuscito.", false);
    }
  });

  refresh();
});
