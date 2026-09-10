const BranchView = (() => {
  const KEY = "firenze1_selected_branca";

  function normalizeBranca(id) {
    if (id === "lupetti") return "branco";
    return id;
  }

  function isValid(id) {
    const n = normalizeBranca(id);
    return !!(n && window.SCOUT_BRANCHES?.[n]);
  }

  function getStored() {
    const raw = normalizeBranca(sessionStorage.getItem(KEY));
    if (!raw || raw === "gruppo") return null;
    return isValid(raw) ? raw : null;
  }

  function setStored(branca) {
    sessionStorage.setItem(KEY, branca || "gruppo");
  }

  /** URL > session > staff branca (non admin) */
  function resolveInitial() {
    const params = new URLSearchParams(location.search);
    const fromUrl = normalizeBranca(params.get("branca"));
    if (fromUrl === "gruppo" || fromUrl === "") return null;
    if (isValid(fromUrl)) return fromUrl;

    const stored = getStored();
    if (stored) return stored;

    const user = typeof ScoutStore !== "undefined" ? ScoutStore.getCurrentUser() : null;
    if (user && !ScoutStore.isAdminUser(user) && isValid(user.branca)) {
      return normalizeBranca(user.branca);
    }
    return null;
  }

  function isHomePage() {
    const file = location.pathname.split("/").pop() || "";
    return file === "" || file === "index.html";
  }

  function persist(branca, { updateUrl = true } = {}) {
    const clean = branca ? normalizeBranca(branca) : null;
    setStored(clean);
    if (updateUrl && isHomePage()) {
      const url = new URL(location.href);
      if (clean) url.searchParams.set("branca", clean);
      else url.searchParams.delete("branca");
      // preserva l'ancora (#chi-siamo, #contatti, …)
      history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
    wireHomeLinks();
  }

  function homeHref(base = "") {
    const branca = getStored();
    const path = `${base}index.html`;
    return branca ? `${path}?branca=${encodeURIComponent(branca)}` : path;
  }

  function groupHomeHref(base = "", hash = "") {
    const h = hash && hash.startsWith("#") ? hash : hash ? `#${hash}` : "";
    return `${base}index.html?branca=gruppo${h}`;
  }

  function wireHomeLinks() {
    document.querySelectorAll("[data-home-link]").forEach((a) => {
      const base = a.dataset.homeBase || "";
      a.setAttribute("href", homeHref(base));
    });
    document.querySelectorAll("[data-group-home]").forEach((a) => {
      const base = a.dataset.homeBase || "";
      const hash = a.dataset.hash || "";
      a.setAttribute("href", groupHomeHref(base, hash));
    });
  }

  return { resolveInitial, persist, homeHref, groupHomeHref, wireHomeLinks, getStored, isValid, normalizeBranca };
})();
