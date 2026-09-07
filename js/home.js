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
  const calElRep = document.getElementById("cal-grid-reparto");
  const listElRep = document.getElementById("event-list-reparto");
  const labelElRep = document.getElementById("month-label-reparto");
  const prevBtnRep = document.getElementById("month-prev-reparto");
  const nextBtnRep = document.getElementById("month-next-reparto");
  const viewRoot = document.getElementById("view-root");
  const gruppoBtn = document.getElementById("view-gruppo");
  const branchMenu = document.getElementById("branch-menu");
  const branchTrigger = document.getElementById("branch-menu-trigger");
  const branchTriggerLabel = document.getElementById("branch-trigger-label");
  const branchPanel = document.getElementById("branch-menu-panel");
  const calLead = document.getElementById("cal-lead");
  const sediLead = document.getElementById("sedi-lead");
  const sediTitle = document.getElementById("sedi-title");
  const layoutDefault = document.getElementById("layout-default");
  const layoutReparto = document.getElementById("layout-reparto");
  const nextEventEl = document.getElementById("reparto-next-event");

  let selectedBranca = null;
  let viewDate = new Date();
  viewDate.setDate(1);

  const PASTEL_CLASS = {
    lupetti: "pastel-lupetti",
    reparto: "pastel-reparto",
    noviziato: "pastel-noviziato",
    clan: "pastel-clan",
  };

  const BRANCH_COPY = {
    null: {
      sediTitle: "Dove ci trovi",
      sediLead: "Sedi, campo estivo e San Giorgio.",
      calLead: "Appuntamenti di gruppo.",
      heroLine:
        "Avventura, servizio e crescita tra le colline fiorentine. Un gruppo FederScout, tante strade — un unico sentiero insieme.",
      viewLabel: "Vista gruppo",
    },
    lupetti: {
      sediTitle: "Lupetti",
      sediLead: "Gioco, natura e vita di branco.",
      calLead: "Calendario lupetti e gruppo.",
      heroLine: "Branco in cammino: gioco, amicizia e grandi scoperte.",
      viewLabel: "Vista Lupetti",
    },
    reparto: {
      sediTitle: "Reparto",
      sediLead: "",
      calLead: "Eventi reparto e di gruppo.",
      heroLine: "",
      viewLabel: "Vista Reparto",
    },
    noviziato: {
      sediTitle: "Noviziato",
      sediLead: "Discernimento, servizio e crescita.",
      calLead: "Calendario noviziato e gruppo.",
      heroLine: "Noviziato: un anno per scegliere e servire.",
      viewLabel: "Vista Noviziato",
    },
    clan: {
      sediTitle: "Clan",
      sediLead: "Servizio, strada e comunità.",
      calLead: "Calendario clan e gruppo.",
      heroLine: "Clan in servizio: responsabilità e comunità adulta.",
      viewLabel: "Vista Clan",
    },
  };

  function currentEvents() {
    return ScoutStore.getVisibleEvents(selectedBranca, user);
  }

  function nearestEvent() {
    const today = ymd(new Date());
    return currentEvents().find((e) => e.date >= today) || null;
  }

  function renderRepartoNext() {
    if (!nextEventEl) return;
    const ev = nearestEvent();
    if (!ev) {
      nextEventEl.innerHTML = `<div class="empty-state">Nessun evento in programma per il reparto.</div>`;
      return;
    }
    const dateLabel = new Date(ev.date + "T12:00:00").toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    nextEventEl.innerHTML = `
      <div class="next-event-inner">
        ${eventBadge(ev)}
        <h3 style="margin:.6rem 0 .35rem;font-size:1.7rem">${escapeHtml(ev.title)}</h3>
        <p class="next-event-meta"><strong>Data:</strong> ${escapeHtml(dateLabel)}${ev.time ? " · " + escapeHtml(ev.time) : ""}</p>
        <p class="next-event-meta"><strong>Luogo:</strong> ${escapeHtml(ev.place || "Da definire")}</p>
        ${ev.notes ? `<p class="next-event-desc">${escapeHtml(ev.notes)}</p>` : ""}
      </div>`;
  }

  function paintCalendar(targetCal, targetList, targetLabel) {
    if (!targetCal || !targetList || !targetLabel) return;
    const events = currentEvents();
    targetLabel.textContent = formatMonthYear(viewDate);
    renderMonthCalendar(targetCal, events, viewDate);
    renderEventList(targetList, events);
  }

  function refreshCalendar() {
    if (selectedBranca === "reparto") {
      renderRepartoNext();
      paintCalendar(calElRep, listElRep, labelElRep);
      return;
    }

    if (embed && embed.includes("google.com/calendar") && gcalWrap && gcalFrame) {
      gcalWrap.hidden = false;
      gcalFrame.src = embed;
      if (localWrap) localWrap.hidden = true;
      return;
    }

    paintCalendar(calEl, listEl, labelEl);
  }

  function applyBranchView(branca) {
    selectedBranca = branca;
    BranchView.persist(branca);
    const copy = BRANCH_COPY[branca || "null"] || BRANCH_COPY.null;
    const isReparto = branca === "reparto";

    if (viewRoot) {
      viewRoot.classList.add("is-switching");
      window.setTimeout(() => {
        viewRoot.dataset.branca = branca || "gruppo";

        if (layoutDefault) layoutDefault.hidden = isReparto;
        if (layoutReparto) layoutReparto.hidden = !isReparto;

        if (!isReparto) {
          if (sediTitle) sediTitle.textContent = copy.sediTitle;
          if (sediLead) sediLead.textContent = copy.sediLead;
          if (calLead) calLead.textContent = copy.calLead;
          const heroP = document.getElementById("hero-lead");
          if (heroP) heroP.textContent = copy.heroLine;

          document.querySelectorAll("#layout-default [data-branca-panel]").forEach((el) => {
            const only = el.getAttribute("data-branca-panel");
            if (only === "gruppo") el.hidden = !!branca;
            else el.hidden = branca !== only;
          });
        }

        refreshCalendar();
        viewRoot.classList.remove("is-switching");
      }, 180);
    } else {
      refreshCalendar();
    }

    gruppoBtn?.classList.toggle("is-active", !branca);
    if (branchTrigger) {
      branchTrigger.classList.toggle("is-active", !!branca);
      Object.values(PASTEL_CLASS).forEach((cls) => branchTrigger.classList.remove(cls));
      if (branca && PASTEL_CLASS[branca]) branchTrigger.classList.add(PASTEL_CLASS[branca]);
    }
    if (branchTriggerLabel) {
      branchTriggerLabel.textContent = branca
        ? ScoutStore.branchLabel(branca)
        : "Branca";
    }
    branchPanel?.querySelectorAll("[data-branca]").forEach((btn) => {
      btn.classList.toggle("is-selected", btn.dataset.branca === branca);
    });
    closeBranchMenu();
  }

  function openBranchMenu() {
    if (!branchMenu || !branchTrigger) return;
    branchMenu.classList.add("is-open");
    branchTrigger.setAttribute("aria-expanded", "true");
  }

  function closeBranchMenu() {
    if (!branchMenu || !branchTrigger) return;
    branchMenu.classList.remove("is-open");
    branchTrigger.setAttribute("aria-expanded", "false");
  }

  function onDayClick(calNode) {
    calNode?.addEventListener("click", (e) => {
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
  }

  gruppoBtn?.addEventListener("click", () => applyBranchView(null));

  branchTrigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (branchMenu?.classList.contains("is-open")) closeBranchMenu();
    else openBranchMenu();
  });

  branchPanel?.addEventListener("click", (e) => {
    const item = e.target.closest("[data-branca]");
    if (!item) return;
    applyBranchView(item.dataset.branca);
  });

  document.addEventListener("click", (e) => {
    if (!branchMenu?.contains(e.target)) closeBranchMenu();
  });

  function bindMonthNav(prev, next) {
    prev?.addEventListener("click", () => {
      viewDate.setMonth(viewDate.getMonth() - 1);
      refreshCalendar();
    });
    next?.addEventListener("click", () => {
      viewDate.setMonth(viewDate.getMonth() + 1);
      refreshCalendar();
    });
  }

  bindMonthNav(prevBtn, nextBtn);
  bindMonthNav(prevBtnRep, nextBtnRep);
  onDayClick(calEl);
  onDayClick(calElRep);

  applyBranchView(BranchView.resolveInitial());
});
