/* Shell area personale (Ripartari): menu a tendina. */
window.PersonaleShell = (() => {
  function requireUser() {
    const user = ScoutStore.getCurrentUser();
    if (!user) {
      location.href = "./login.html";
      return null;
    }
    if (ScoutStore.isStaffUser?.(user)) {
      location.href = "../staff/";
      return null;
    }
    return user;
  }

  function menuItems() {
    return [
      { id: "home", href: "./index.html", label: "Profilo / sentiero" },
      { id: "dati", href: "./dati.html", label: "Dati personali" },
      { id: "sentiero", href: "../sentiero/", label: "Libretto e specialità" },
      { id: "riparto", href: "../index.html?branca=riparto", label: "Torna al Riparto" },
    ];
  }

  function mountMenu(user, { active = "home" } = {}) {
    const hero = document.querySelector(".personale-hero") || document.querySelector(".staff-hero");
    if (!hero || hero.querySelector(".personale-menu-btn")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "personale-menu-btn staff-menu-btn";
    btn.setAttribute("aria-label", "Apri menu area personale");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = `<span></span><span></span><span></span>`;

    const inner = hero.querySelector(":scope > div") || hero.firstElementChild;
    if (inner) hero.insertBefore(btn, inner);
    else hero.prepend(btn);

    let drawer = document.getElementById("personale-menu-drawer");
    if (!drawer) {
      drawer = document.createElement("div");
      drawer.id = "personale-menu-drawer";
      drawer.className = "staff-menu-drawer";
      drawer.hidden = true;
      document.body.appendChild(drawer);
    }

    const items = menuItems();
    drawer.innerHTML = `
      <div class="staff-menu-backdrop" data-close-menu></div>
      <nav class="staff-menu-panel" aria-label="Menu area personale">
        <div class="staff-menu-head">
          <strong>Area personale</strong>
          <button type="button" class="btn btn-ghost btn-small" data-close-menu>Chiudi</button>
        </div>
        <ul class="staff-menu-list">
          ${items
            .map(
              (item) => `
            <li>
              <a class="staff-menu-link ${item.id === active ? "is-active" : ""}" href="${item.href}">
                <span>${escapeHtml(item.label)}</span>
              </a>
            </li>`
            )
            .join("")}
          <li>
            <button type="button" class="staff-menu-link" data-personale-logout style="width:100%;text-align:left;background:none;border:0;cursor:pointer;font:inherit">
              <span>Esci</span>
            </button>
          </li>
        </ul>
      </nav>`;

    function open() {
      drawer.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      document.body.classList.add("staff-menu-open");
    }
    function close() {
      drawer.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      document.body.classList.remove("staff-menu-open");
    }

    btn.addEventListener("click", () => {
      if (drawer.hidden) open();
      else close();
    });
    drawer.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-menu]")) close();
    });
    drawer.querySelector("[data-personale-logout]")?.addEventListener("click", () => {
      ScoutStore.logout();
      location.href = "../index.html";
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  function boot({ active = "home" } = {}) {
    const user = requireUser();
    if (!user) return null;
    mountMenu(user, { active });
    ScoutStore.pullRemoteAccounts?.().catch(() => {});
    return user;
  }

  return { requireUser, menuItems, mountMenu, boot };
})();
