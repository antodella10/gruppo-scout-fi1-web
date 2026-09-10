/* Contatori richieste in attesa per bollini staff (nav, menu, dashboard). */
window.StaffNotifs = (() => {
  function counts(user) {
    if (!user) return { songs: 0, shop: 0, staff: 0, total: 0 };

    const songs =
      typeof CanzoniereStore !== "undefined" && CanzoniereStore.canManage(user)
        ? CanzoniereStore.pendingProposalsCount()
        : 0;

    const shop =
      typeof ScoutStore !== "undefined" &&
      ScoutStore.isAdminUser(user) &&
      typeof ShopStore !== "undefined"
        ? ShopStore.pendingOrdersCount()
        : 0;

    const staff =
      typeof ScoutStore !== "undefined" && ScoutStore.isAdminUser(user)
        ? ScoutStore.listPending(user).length
        : 0;

    return { songs, shop, staff, total: songs + shop + staff };
  }

  function formatCount(n) {
    return n > 9 ? "9+" : String(n);
  }

  function badgeHtml(n, title = "Notifiche") {
    if (!n) return "";
    return `<span class="notif-badge" title="${escapeHtml(title)}">${formatCount(n)}</span>`;
  }

  function alertText(n, singular, plural) {
    if (!n) return "";
    const label = n === 1 ? singular : plural;
    return `<span class="dash-tile-alert">${n} ${label}</span>`;
  }

  function titleFor(c) {
    const parts = [];
    if (c.songs) parts.push(`${c.songs} proposte canzoniere`);
    if (c.shop) parts.push(`${c.shop} ordini negozio`);
    if (c.staff) parts.push(`${c.staff} richieste staff`);
    return parts.join(" · ") || "Notifiche";
  }

  async function pullAll() {
    await Promise.all([
      typeof CanzoniereStore !== "undefined" && CanzoniereStore.pullRemote
        ? CanzoniereStore.pullRemote().catch(() => {})
        : Promise.resolve(),
      typeof ShopStore !== "undefined" && ShopStore.pullRemote
        ? ShopStore.pullRemote().catch(() => {})
        : Promise.resolve(),
      typeof ScoutStore !== "undefined" && ScoutStore.pullRemoteAccounts
        ? ScoutStore.pullRemoteAccounts().catch(() => {})
        : Promise.resolve(),
    ]);
  }

  return { counts, formatCount, badgeHtml, alertText, titleFor, pullAll };
})();
