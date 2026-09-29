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
    socialForm.igBrancoLabel.value = current.instagram.branco.label || "Branco";
    socialForm.igBrancoUrl.value = current.instagram.branco.url || "";
    socialForm.igRipartoLabel.value = current.instagram.riparto.label || "Riparto";
    socialForm.igRipartoUrl.value = current.instagram.riparto.url || "";
    socialForm.igNoviziatoLabel.value = current.instagram.noviziato.label || "Noviziato";
    socialForm.igNoviziatoUrl.value = current.instagram.noviziato.url || "";
    socialForm.igClanLabel.value = current.instagram.clan.label || "Clan";
    socialForm.igClanUrl.value = current.instagram.clan.url || "";
    const home = current.homeInstagram || "riparto";
    const radio = socialForm.querySelector(`input[name="homeInstagram"][value="${home}"]`);
    if (radio) radio.checked = true;
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
            branco: { label: data.get("igBrancoLabel"), url: data.get("igBrancoUrl") },
            riparto: { label: data.get("igRipartoLabel"), url: data.get("igRipartoUrl") },
            noviziato: { label: data.get("igNoviziatoLabel"), url: data.get("igNoviziatoUrl") },
            clan: { label: data.get("igClanLabel"), url: data.get("igClanUrl") },
          },
          homeInstagram: data.get("homeInstagram") || "riparto",
        },
        user
      );
      flashAlert(socialAlert, "Link social aggiornati.", true);
    } catch (err) {
      flashAlert(socialAlert, err.message || "Salvataggio non riuscito.", false);
    }
  });
});
