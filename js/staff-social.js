document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "social", requireAdmin: true });
  if (!user) return;

  const socialForm = document.getElementById("social-form");
  const socialAlert = document.getElementById("social-alert");
  const current = ScoutStore.getSocialLinks();
  if (socialForm) {
    socialForm.facebook.value = current.facebook || "";
    socialForm.igGruppo.value = current.instagram.gruppo || "";
    socialForm.igLupetti.value = current.instagram.lupetti || "";
    socialForm.igReparto.value = current.instagram.reparto || "";
    socialForm.igNoviziato.value = current.instagram.noviziato || "";
    socialForm.igClan.value = current.instagram.clan || "";
  }

  socialForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(socialForm);
    try {
      ScoutStore.saveSocialLinks(
        {
          facebook: data.get("facebook"),
          instagram: {
            gruppo: data.get("igGruppo"),
            lupetti: data.get("igLupetti"),
            reparto: data.get("igReparto"),
            noviziato: data.get("igNoviziato"),
            clan: data.get("igClan"),
          },
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
