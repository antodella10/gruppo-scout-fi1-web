document.addEventListener("DOMContentLoaded", () => {
  // staff.js già fa boot su home se data-staff-page=home; qui solo tile
  const user = ScoutStore.getCurrentUser();
  if (!user) return;

  const dash = document.getElementById("staff-dash");
  const customizeBtn = document.getElementById("dash-customize-btn");
  const customizePanel = document.getElementById("dash-customize-panel");
  const customizeList = document.getElementById("dash-customize-list");
  const customizeSave = document.getElementById("dash-customize-save");
  const customizeReset = document.getElementById("dash-customize-reset");
  if (!dash) return;

  const isAdmin = ScoutStore.isAdminUser(user);

  function pendingSongsCount() {
    return typeof StaffNotifs !== "undefined"
      ? StaffNotifs.counts(user).songs
      : typeof CanzoniereStore !== "undefined" && CanzoniereStore.canManage(user)
        ? CanzoniereStore.pendingProposalsCount()
        : 0;
  }

  function pendingStaffCount() {
    return typeof StaffNotifs !== "undefined"
      ? StaffNotifs.counts(user).staff
      : ScoutStore.canManageStaffRequests?.(user)
        ? ScoutStore.listPendingStaff(user).length
        : 0;
  }

  function pendingRagazziCount() {
    return typeof StaffNotifs !== "undefined"
      ? StaffNotifs.counts(user).ragazzi || 0
      : ScoutStore.canManageRagazziRequests?.(user)
        ? ScoutStore.listPendingRagazzi(user).length
        : 0;
  }

  function pendingShopCount() {
    return typeof StaffNotifs !== "undefined"
      ? StaffNotifs.counts(user).shop
      : typeof ShopStore !== "undefined" && isAdmin
        ? ShopStore.pendingOrdersCount()
        : 0;
  }

  function buildTiles() {
    const hours = ScoutStore.getMeetingHours().filter((h) => ScoutStore.canEditMeetingSlot(user, h));
    const pendingStaff = pendingStaffCount();
    const pendingRagazzi = pendingRagazziCount();
    const pendingAccounts = pendingStaff + pendingRagazzi;
    const pendingSongs = pendingSongsCount();
    const shopPending = pendingShopCount();
    const calendars = isAdmin ? ScoutStore.listGoogleCalendars() : [];
    const social = isAdmin ? ScoutStore.getSocialLinks() : null;
    const newsCount = typeof NewsStore !== "undefined" ? NewsStore.getNews().length : 0;
    const tiles = [];

    if (typeof StaffShell !== "undefined" && StaffShell.canMeetings(user)) {
      const preview = hours
        .slice(0, 3)
        .map((h) => `${escapeHtml(h.label)}: ${escapeHtml([h.day, h.time].filter(Boolean).join(" · ") || "—")}`)
        .join("<br>");
      tiles.push({
        id: "riunioni",
        href: "./riunioni.html",
        title: "Gestione riunioni",
        hint: isAdmin ? "Orari di tutte le branche e sedi." : "Orari della tua branca.",
        preview: preview || "Imposta gli orari",
      });
    }

    if (typeof StaffShell !== "undefined" && StaffShell.canCanzoniere(user)) {
      tiles.push({
        id: "canzoniere",
        href: "./canzoniere.html",
        title: "Canzoniere Riparto",
        hint: "PDF, canzoni sfuse e proposte.",
        badge: pendingSongs,
        preview: pendingSongs
          ? (typeof StaffNotifs !== "undefined"
              ? StaffNotifs.alertText(pendingSongs, "proposta in attesa", "proposte in attesa")
              : `<strong>${pendingSongs}</strong> proposte in attesa`)
          : "Nessuna proposta in attesa",
      });
    }

    if (ScoutStore.canManageSentieri?.(user)) {
      const nRagazzi = ScoutStore.listRagazziAccounts(user).length;
      tiles.push({
        id: "gestione-sentieri",
        href: "./gestione-sentieri.html",
        title: "Gestione sentieri",
        hint: "Classi e specialità dei Ripartari.",
        preview: nRagazzi
          ? `<strong>${nRagazzi}</strong> Ripartari`
          : "Nessun repartaro ancora",
      });
    }

    if (isAdmin) {
      tiles.push({
        id: "notizie",
        href: "./notizie.html",
        title: "Gestione notizie",
        hint: "Pubblica aggiornamenti in home e pagina Notizie.",
        preview: newsCount
          ? `<strong>${newsCount}</strong> notizi${newsCount === 1 ? "a" : "e"}`
          : "Nessuna notizia",
      });

      const formUrl = ScoutStore.getIscrizioniFormUrl?.() || "";
      tiles.push({
        id: "iscrizioni",
        href: "./iscrizioni.html",
        title: "Form iscrizioni",
        hint: "Link del Google Form nella pagina pubblica.",
        preview: formUrl ? "Form collegato" : "Nessun link impostato",
      });
    }

    if (typeof StaffShell !== "undefined" && StaffShell.canAccountRequests?.(user)) {
      const parts = [];
      if (pendingStaff) parts.push(`${pendingStaff} staff`);
      if (pendingRagazzi) parts.push(`${pendingRagazzi} Ripartari`);
      tiles.push({
        id: "richieste",
        href: "./richieste.html",
        title: "Richieste account",
        hint: "Approva staff e esploratori/guide.",
        badge: pendingAccounts,
        preview: pendingAccounts
          ? typeof StaffNotifs !== "undefined"
            ? StaffNotifs.alertText(
                pendingAccounts,
                "richiesta in attesa",
                "richieste in attesa"
              ) + (parts.length ? ` <span class="hint">(${parts.join(" · ")})</span>` : "")
            : `<strong>${pendingAccounts}</strong> in attesa`
          : "Nessuna richiesta in attesa",
      });
    }

    if (isAdmin) {
      const igCount = Object.values(social.instagram || {}).filter((x) => x?.url).length;
      tiles.push({
        id: "social",
        href: "./social.html",
        title: "Gestione link social",
        hint: "Nomi, URL e Instagram in home.",
        preview: `${social.facebook?.url ? "Facebook ok" : "Facebook mancante"} · ${igCount} Instagram`,
      });

      tiles.push({
        id: "calendari",
        href: "./calendari.html",
        title: "Calendari Google",
        hint: "Collega i calendari alle branche.",
        preview: calendars.length
          ? `<strong>${calendars.length}</strong> calendari collegati`
          : "Nessun calendario collegato",
      });

      const shopCount =
        typeof ShopStore !== "undefined" ? ShopStore.getItems().length : 0;
      tiles.push({
        id: "negozio",
        href: "./negozio.html",
        title: "Negozio · Kala Nag",
        hint: "Catalogo e richieste di ritiro in sede.",
        badge: shopPending,
        preview: shopPending
          ? (typeof StaffNotifs !== "undefined"
              ? StaffNotifs.alertText(shopPending, "richiesta in attesa", "richieste in attesa")
              : `<strong>${shopPending}</strong> richieste in attesa`)
          : shopCount
            ? `<strong>${shopCount}</strong> oggett${shopCount === 1 ? "o" : "i"} · nessuna richiesta`
            : "Catalogo vuoto",
      });
    }

    tiles.push({
      id: "note-punteggi",
      href: "./note-punteggi.html",
      title: "Note e punteggi",
      hint: "Note condivise per branca e link ai fogli.",
      preview: "Apri note dello staff",
    });

    tiles.push({
      id: "documenti",
      href: "./documenti.html",
      title: "File e documenti",
      hint: "Sentiero, specialità e galleria.",
      preview: "Apri hub documenti",
    });

    return tiles;
  }

  function visibleTiles(all) {
    const prefs =
      typeof NewsStore !== "undefined" ? NewsStore.getDashTilePrefs(user.id) : null;
    if (!prefs) return all;
    const allowed = new Set(prefs);
    const filtered = all.filter((t) => allowed.has(t.id));
    return filtered.length ? filtered : all;
  }

  function renderDash() {
    const all = buildTiles();
    const tiles = visibleTiles(all);
    dash.innerHTML = tiles
      .map(
        (t) => `
    <a class="dash-tile" href="${t.href}">
      ${t.badge && typeof StaffNotifs !== "undefined" ? StaffNotifs.badgeHtml(t.badge) : ""}
      <span class="dash-tile-kicker">Apri</span>
      <h2>${escapeHtml(t.title)}</h2>
      <p class="hint">${escapeHtml(t.hint)}</p>
      <div class="dash-tile-preview">${t.preview}</div>
    </a>`
      )
      .join("");
  }

  function renderCustomize() {
    if (!customizeList) return;
    const all = buildTiles();
    const prefs = typeof NewsStore !== "undefined" ? NewsStore.getDashTilePrefs(user.id) : null;
    customizeList.innerHTML = all
      .map((t) => {
        const checked = !prefs || prefs.includes(t.id);
        return `
        <label class="dash-customize-item">
          <input type="checkbox" name="dashTile" value="${escapeHtml(t.id)}" ${checked ? "checked" : ""}>
          <span>${escapeHtml(t.title)}</span>
        </label>`;
      })
      .join("");
  }

  customizeBtn?.addEventListener("click", () => {
    if (!customizePanel) return;
    const open = customizePanel.hidden;
    customizePanel.hidden = !open;
    customizeBtn.setAttribute("aria-expanded", open ? "true" : "false");
    customizeBtn.textContent = open ? "Chiudi personalizzazione" : "Personalizza dashboard";
    if (open) renderCustomize();
  });

  customizeSave?.addEventListener("click", () => {
    const checked = [...(customizeList?.querySelectorAll('input[name="dashTile"]:checked') || [])].map(
      (el) => el.value
    );
    if (!checked.length) {
      alert("Seleziona almeno una tile.");
      return;
    }
    NewsStore.setDashTilePrefs(user.id, checked);
    renderDash();
    if (customizePanel) customizePanel.hidden = true;
    if (customizeBtn) {
      customizeBtn.textContent = "Personalizza dashboard";
      customizeBtn.setAttribute("aria-expanded", "false");
    }
  });

  customizeReset?.addEventListener("click", () => {
    NewsStore.setDashTilePrefs(user.id, null);
    renderCustomize();
    renderDash();
  });

  document.addEventListener("staff-notifs-updated", renderDash);

  renderDash();
});
