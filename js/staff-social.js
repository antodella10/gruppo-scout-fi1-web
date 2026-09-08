document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "social", requireAdmin: true });
  if (!user) return;

  const socialForm = document.getElementById("social-form");
  const socialAlert = document.getElementById("social-alert");
  const current = ScoutStore.getSocialLinks();

  if (socialForm) {
    socialForm.fbLabel.value = current.facebook.label || "Facebook";
    socialForm.fbUrl.value = current.facebook.url || "";
    socialForm.igGruppoLabel.value = current.instagram.gruppo.label || "Firenze 1";
    socialForm.igGruppoUrl.value = current.instagram.gruppo.url || "";
    socialForm.igLupettiLabel.value = current.instagram.lupetti.label || "Lupetti";
    socialForm.igLupettiUrl.value = current.instagram.lupetti.url || "";
    socialForm.igRepartoLabel.value = current.instagram.reparto.label || "Reparto";
    socialForm.igRepartoUrl.value = current.instagram.reparto.url || "";
    socialForm.igNoviziatoLabel.value = current.instagram.noviziato.label || "Noviziato";
    socialForm.igNoviziatoUrl.value = current.instagram.noviziato.url || "";
    socialForm.igClanLabel.value = current.instagram.clan.label || "Clan";
    socialForm.igClanUrl.value = current.instagram.clan.url || "";
    socialForm.homeInstagram.value = current.homeInstagram || "reparto";
  }

  socialForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(socialForm);
    try {
      ScoutStore.saveSocialLinks(
        {
          facebook: {
            label: data.get("fbLabel"),
            url: data.get("fbUrl"),
          },
          instagram: {
            gruppo: { label: data.get("igGruppoLabel"), url: data.get("igGruppoUrl") },
            lupetti: { label: data.get("igLupettiLabel"), url: data.get("igLupettiUrl") },
            reparto: { label: data.get("igRepartoLabel"), url: data.get("igRepartoUrl") },
            noviziato: { label: data.get("igNoviziatoLabel"), url: data.get("igNoviziatoUrl") },
            clan: { label: data.get("igClanLabel"), url: data.get("igClanUrl") },
          },
          homeInstagram: data.get("homeInstagram") || "reparto",
        },
        user
      );
      if (socialAlert) {
        socialAlert.hidden = false;
        socialAlert.className = "alert alert-ok";
        socialAlert.textContent = "Link social aggiornati.";
      }
    } catch (err) {
      if (socialAlert) {
        socialAlert.hidden = false;
        socialAlert.className = "alert alert-error";
        socialAlert.textContent = err.message || "Salvataggio non riuscito.";
      }
    }
  });
});
