document.addEventListener("DOMContentLoaded", () => {
  const user = ScoutStore.getCurrentUser();
  const embed = window.SCOUT_CONFIG?.homeCalendarEmbed?.trim();
  const gcalWrap = document.getElementById("gcal-home-wrap");
  const gcalFrame = document.getElementById("gcal-home");
  const localWrap = document.getElementById("local-calendar-wrap");
  const calEl = document.getElementById("cal-grid");
  const listEl = document.getElementById("event-list");
  const labelEl = document.getElementById("month-label");
  const prevBtn = document.getElementById("month-prev");
  const nextBtn = document.getElementById("month-next");
  const viewRoot = document.getElementById("view-root");
  const branchBar = document.getElementById("branch-selector");
  const calLead = document.getElementById("cal-lead");
  const sediLead = document.getElementById("sedi-lead");
  const sediTitle = document.getElementById("sedi-title");

  let selectedBranca = null; // null = solo gruppo
  let viewDate = new Date();
  viewDate.setDate(1);

  const BRANCH_COPY = {
    null: {
      sediTitle: "Dove ci trovi",
      sediLead: "Sedi, campo estivo e San Giorgio — i momenti e i luoghi del gruppo.",
      calLead: "Appuntamenti di gruppo. Scegli una branca per vedere anche le sue attività.",
      heroLine: "Avventura, servizio e crescita tra le colline fiorentine. Un gruppo FederScout, tante strade — un unico sentiero insieme.",
    },
    lupetti: {
      sediTitle: "Lupetti",
      sediLead: "La branca più piccola: gioco, natura e la scoperta della vita di branco.",
      calLead: "Eventi lupetti + gruppo. Se sei staff, vedi anche staff lupetti e Co.Ca.",
      heroLine: "Branco in cammino: gioco, amicizia e grandi scoperte per i più piccoli.",
    },
    reparto: {
      sediTitle: "Reparto",
      sediLead: "Esplorazione, pattuglie e avventura: il cuore dell’esperienza scout.",
      calLead: "Eventi reparto + gruppo. Se sei staff, vedi anche staff reparto e Co.Ca.",
      heroLine: "Reparto in strada: uscite, imprese e lo spirito di pattuglia.",
    },
    noviziato: {
      sediTitle: "Noviziato",
      sediLead: "Il ponte verso il clan: discernimento, servizio e crescita personale.",
      calLead: "Eventi noviziato + gruppo. Se sei staff, vedi anche staff noviziato e Co.Ca.",
      heroLine: "Noviziato: un anno per scegliere, servire e diventare protagonisti.",
    },
    clan: {
      sediTitle: "Clan",
      sediLead: "Servizio, strada e comunità: i grandi del gruppo.",
      calLead: "Eventi clan + gruppo. Se sei staff, vedi anche staff clan e Co.Ca.",
      heroLine: "Clan in servizio: responsabilità, strada e comunità adulta.",
    },
  };

  function currentEvents() {
    return ScoutStore.getVisibleEvents(selectedBranca, user);
  }

  function refreshCalendar() {
    if (embed && embed.includes("google.com/calendar") && gcalWrap && gcalFrame) {
      gcalWrap.hidden = false;
      gcalFrame.src = embed;
      if (localWrap) localWrap.hidden = true;
      return;
    }
    if (!calEl || !listEl || !labelEl) return;
    const events = currentEvents();
    labelEl.textContent = formatMonthYear(viewDate);
    renderMonthCalendar(calEl, events, viewDate);
    renderEventList(listEl, events);
  }

  function applyBranchView(branca) {
    selectedBranca = branca;
    const copy = BRANCH_COPY[branca || "null"] || BRANCH_COPY.null;

    if (viewRoot) {
      viewRoot.classList.add("is-switching");
      window.setTimeout(() => {
        if (sediTitle) sediTitle.textContent = copy.sediTitle;
        if (sediLead) sediLead.textContent = copy.sediLead;
        if (calLead) calLead.textContent = copy.calLead;
        const heroP = document.getElementById("hero-lead");
        if (heroP) heroP.textContent = copy.heroLine;

        viewRoot.dataset.branca = branca || "gruppo";
        document.querySelectorAll("[data-branca-panel]").forEach((el) => {
          const only = el.getAttribute("data-branca-panel");
          if (only === "gruppo") {
            el.hidden = !!branca;
          } else {
            el.hidden = branca !== only;
          }
        });

        refreshCalendar();
        viewRoot.classList.remove("is-switching");
      }, 180);
    } else {
      refreshCalendar();
    }

    branchBar?.querySelectorAll("[data-branca]").forEach((btn) => {
      const val = btn.getAttribute("data-branca");
      const active = (val === "" && !branca) || val === branca;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  branchBar?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-branca]");
    if (!btn) return;
    const val = btn.getAttribute("data-branca");
    applyBranchView(val === "" ? null : val);
  });

  prevBtn?.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    refreshCalendar();
  });

  nextBtn?.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    refreshCalendar();
  });

  calEl?.addEventListener("click", (e) => {
    const day = e.target.closest(".cal-day.has-event");
    if (!day) return;
    const date = day.dataset.date;
    const match = currentEvents().filter((ev) => ev.date === date);
    if (!match.length) return;
    const titles = match
      .map((m) => `• [${ScoutStore.scopeLabel(m.scope, m.branca)}] ${m.title}${m.time ? " (" + m.time + ")" : ""}`)
      .join("\n");
    alert(`${date}\n\n${titles}`);
  });

  applyBranchView(null);
});
