document.addEventListener("DOMContentLoaded", () => {
  // staff.js già fa boot su home se data-staff-page=home; qui solo tile
  const user = ScoutStore.getCurrentUser();
  if (!user) return;

  const dash = document.getElementById("staff-dash");
  if (!dash) return;

  const isAdmin = ScoutStore.isAdminUser(user);
  const hours = ScoutStore.getMeetingHours().filter((h) => ScoutStore.canEditMeetingSlot(user, h));
  const pendingStaff = isAdmin ? ScoutStore.listPending(user) : [];
  const pendingSongs =
    typeof CanzoniereStore !== "undefined" && CanzoniereStore.canManage(user)
      ? CanzoniereStore.getProposals().filter((p) => p.status === "pending")
      : [];
  const calendars = isAdmin ? ScoutStore.listGoogleCalendars() : [];
  const social = isAdmin ? ScoutStore.getSocialLinks() : null;

  const tiles = [];

  if (typeof StaffShell !== "undefined" && StaffShell.canMeetings(user)) {
    const preview = hours
      .slice(0, 3)
      .map((h) => `${escapeHtml(h.label)}: ${escapeHtml([h.day, h.time].filter(Boolean).join(" · ") || "—")}`)
      .join("<br>");
    tiles.push({
      href: "./riunioni.html",
      title: "Gestione riunioni",
      hint: isAdmin ? "Orari di tutte le branche e sedi." : "Orari della tua branca.",
      preview: preview || "Imposta gli orari",
    });
  }

  if (typeof StaffShell !== "undefined" && StaffShell.canCanzoniere(user)) {
    tiles.push({
      href: "./canzoniere.html",
      title: "Canzoniere reparto",
      hint: "PDF, canzoni sfuse e proposte.",
      preview: pendingSongs.length
        ? `<strong>${pendingSongs.length}</strong> proposte in attesa`
        : "Nessuna proposta in attesa",
    });
  }

  if (isAdmin) {
    tiles.push({
      href: "./richieste.html",
      title: "Richieste staff",
      hint: "Approva o rifiuta le registrazioni.",
      preview: pendingStaff.length
        ? `<strong>${pendingStaff.length}</strong> in attesa`
        : "Nessuna richiesta in attesa",
    });

    const igCount = Object.values(social.instagram || {}).filter((x) => x?.url).length;
    tiles.push({
      href: "./social.html",
      title: "Gestione link social",
      hint: "Nomi, URL e Instagram in home.",
      preview: `${social.facebook?.url ? "Facebook ok" : "Facebook mancante"} · ${igCount} Instagram`,
    });

    tiles.push({
      href: "./calendari.html",
      title: "Calendari Google",
      hint: "Collega i calendari alle branche.",
      preview: calendars.length
        ? `<strong>${calendars.length}</strong> calendari collegati`
        : "Nessun calendario collegato",
    });

    const shopPending =
      typeof ShopStore !== "undefined" ? ShopStore.pendingOrdersCount() : 0;
    const shopCount =
      typeof ShopStore !== "undefined" ? ShopStore.getItems().length : 0;
    tiles.push({
      href: "./negozio.html",
      title: "Negozio · Kala Nag",
      hint: "Catalogo e richieste di ritiro in sede.",
      preview: shopPending
        ? `<strong>${shopPending}</strong> richiest${shopPending === 1 ? "a" : "e"} in attesa`
        : shopCount
          ? `<strong>${shopCount}</strong> oggett${shopCount === 1 ? "o" : "i"} · nessuna richiesta`
          : "Catalogo vuoto",
    });
  }

  tiles.push({
    href: "./documenti.html",
    title: "File e documenti",
    hint: "Spazio documenti staff.",
    preview: "Presto disponibile",
  });

  dash.innerHTML = tiles
    .map(
      (t) => `
    <a class="dash-tile" href="${t.href}">
      <span class="dash-tile-kicker">Apri</span>
      <h2>${escapeHtml(t.title)}</h2>
      <p class="hint">${escapeHtml(t.hint)}</p>
      <div class="dash-tile-preview">${t.preview}</div>
    </a>`
    )
    .join("");
});
