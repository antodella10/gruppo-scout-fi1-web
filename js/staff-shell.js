/* Shell area staff: auth, hamburger menu, hero. */
window.StaffShell = (() => {
  function requireUser() {
    const user = ScoutStore.getCurrentUser();
    if (!user) {
      location.href = "./login.html";
      return null;
    }
    return user;
  }

  function isAdmin(user) {
    return ScoutStore.isAdminUser(user);
  }

  function canMeetings(user) {
    return ScoutStore.getMeetingHours().some((h) => ScoutStore.canEditMeetingSlot(user, h));
  }

  function canCanzoniere(user) {
    return typeof CanzoniereStore !== "undefined" && CanzoniereStore.canManage(user);
  }

  function canSentiero(user) {
    return typeof SentieroStore !== "undefined" && SentieroStore.canManage(user);
  }

  function menuItems(user) {
    const admin = isAdmin(user);
    const c = typeof StaffNotifs !== "undefined" ? StaffNotifs.counts(user) : { songs: 0, shop: 0, staff: 0 };
    return [
      { id: "home", href: "./index.html", label: "Dashboard" },
      canMeetings(user) ? { id: "riunioni", href: "./riunioni.html", label: "Gestione riunioni" } : null,
      canCanzoniere(user)
        ? { id: "canzoniere", href: "./canzoniere.html", label: "Canzoniere reparto", badge: c.songs }
        : null,
      canSentiero(user) ? { id: "sentiero", href: "./sentiero.html", label: "Sentiero / specialità" } : null,
      { id: "galleria", href: "./galleria.html", label: "Gestione galleria" },
      admin ? { id: "notizie", href: "./notizie.html", label: "Gestione notizie" } : null,
      admin ? { id: "iscrizioni", href: "./iscrizioni.html", label: "Form iscrizioni" } : null,
      admin
        ? { id: "richieste", href: "./richieste.html", label: "Richieste staff", badge: c.staff }
        : null,
      admin ? { id: "social", href: "./social.html", label: "Link social" } : null,
      admin ? { id: "calendari", href: "./calendari.html", label: "Calendari Google" } : null,
      admin
        ? { id: "negozio", href: "./negozio.html", label: "Negozio / Kala Nag", badge: c.shop }
        : null,
      { id: "documenti", href: "./documenti.html", label: "File e documenti" },
    ].filter(Boolean);
  }

  function fillHero(user) {
    const nameEl = document.getElementById("staff-name");
    const metaEl = document.getElementById("staff-meta");
    if (nameEl) nameEl.textContent = `${user.nome} ${user.cognome}`;
    if (metaEl && !metaEl.dataset.static) {
      metaEl.textContent = isAdmin(user)
        ? "Admin generale · tutte le branche"
        : `Staff ${ScoutStore.branchLabel(user.branca)}`;
    }
  }

  function applyMenuBadges(user) {
    const c = typeof StaffNotifs !== "undefined" ? StaffNotifs.counts(user) : { total: 0, songs: 0, shop: 0, staff: 0 };
    const btn = document.querySelector(".staff-menu-btn");
    if (btn) {
      const existing = btn.querySelector(".notif-badge");
      if (existing) existing.remove();
      if (c.total > 0 && typeof StaffNotifs !== "undefined") {
        btn.insertAdjacentHTML(
          "beforeend",
          StaffNotifs.badgeHtml(c.total, StaffNotifs.titleFor(c))
        );
      }
    }

    const drawer = document.getElementById("staff-menu-drawer");
    if (!drawer || typeof StaffNotifs === "undefined") return;
    const byId = {
      canzoniere: c.songs,
      negozio: c.shop,
      richieste: c.staff,
    };
    drawer.querySelectorAll(".staff-menu-link").forEach((link) => {
      link.querySelector(".notif-badge")?.remove();
      const href = link.getAttribute("href") || "";
      const id = Object.keys(byId).find((key) => href.includes(`${key}.html`));
      if (id && byId[id] > 0) {
        link.insertAdjacentHTML("beforeend", StaffNotifs.badgeHtml(byId[id]));
      }
    });
  }

  function mountMenu(user, { active = "home" } = {}) {
    const hero = document.querySelector(".staff-hero");
    if (!hero || hero.querySelector(".staff-menu-btn")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "staff-menu-btn";
    btn.setAttribute("aria-label", "Apri menu staff");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = `<span></span><span></span><span></span>`;

    const inner = hero.querySelector(":scope > div") || hero.firstElementChild;
    if (inner) hero.insertBefore(btn, inner);
    else hero.prepend(btn);

    let drawer = document.getElementById("staff-menu-drawer");
    if (!drawer) {
      drawer = document.createElement("div");
      drawer.id = "staff-menu-drawer";
      drawer.className = "staff-menu-drawer";
      drawer.hidden = true;
      document.body.appendChild(drawer);
    }

    const items = menuItems(user);
    drawer.innerHTML = `
      <div class="staff-menu-backdrop" data-close-menu></div>
      <nav class="staff-menu-panel" aria-label="Menu area staff">
        <div class="staff-menu-head">
          <strong>Area staff</strong>
          <button type="button" class="btn btn-ghost btn-small" data-close-menu>Chiudi</button>
        </div>
        <ul class="staff-menu-list">
          ${items
            .map(
              (item) => `
            <li>
              <a class="staff-menu-link ${item.id === active ? "is-active" : ""}" href="${item.href}">
                <span>${escapeHtml(item.label)}</span>
                ${item.badge && typeof StaffNotifs !== "undefined" ? StaffNotifs.badgeHtml(item.badge) : ""}
              </a>
            </li>`
            )
            .join("")}
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
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    applyMenuBadges(user);
  }

  function boot({ active = "home", requireAdmin = false } = {}) {
    const user = requireUser();
    if (!user) return null;
    if (requireAdmin && !isAdmin(user)) {
      location.href = "./index.html";
      return null;
    }
    fillHero(user);
    mountMenu(user, { active });
    ScoutStore.pullRemoteAccounts?.().catch(() => {});
    ScoutStore.pullRemoteSettings?.().catch(() => {});

    if (typeof StaffNotifs !== "undefined") {
      StaffNotifs.pullAll().then(() => {
        applyMenuBadges(user);
        if (typeof updateNavAuth === "function") updateNavAuth();
        document.dispatchEvent(new CustomEvent("staff-notifs-updated"));
      });
    }
    return user;
  }

  return {
    requireUser,
    isAdmin,
    menuItems,
    canMeetings,
    canCanzoniere,
    canSentiero,
    fillHero,
    mountMenu,
    applyMenuBadges,
    boot,
  };
})();
