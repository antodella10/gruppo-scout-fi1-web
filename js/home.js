document.addEventListener("DOMContentLoaded", () => {
  const embed = window.SCOUT_CONFIG?.homeCalendarEmbed?.trim();
  const gcalWrap = document.getElementById("gcal-home-wrap");
  const gcalFrame = document.getElementById("gcal-home");
  const localWrap = document.getElementById("local-calendar-wrap");

  if (embed && embed.includes("google.com/calendar") && gcalWrap && gcalFrame) {
    gcalWrap.hidden = false;
    gcalFrame.src = embed;
    if (localWrap) localWrap.hidden = true;
    return;
  }

  const events = ScoutStore.getEvents();
  const calEl = document.getElementById("cal-grid");
  const listEl = document.getElementById("event-list");
  const labelEl = document.getElementById("month-label");
  const prevBtn = document.getElementById("month-prev");
  const nextBtn = document.getElementById("month-next");

  if (!calEl || !listEl || !labelEl) return;

  let viewDate = new Date();
  viewDate.setDate(1);

  function refresh() {
    labelEl.textContent = formatMonthYear(viewDate);
    renderMonthCalendar(calEl, events, viewDate);
    renderEventList(listEl, events);
  }

  prevBtn?.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    refresh();
  });

  nextBtn?.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    refresh();
  });

  calEl.addEventListener("click", (e) => {
    const day = e.target.closest(".cal-day.has-event");
    if (!day) return;
    const date = day.dataset.date;
    const match = events.filter((ev) => ev.date === date);
    if (!match.length) return;
    const titles = match.map((m) => `• ${m.title}${m.time ? " (" + m.time + ")" : ""}`).join("\n");
    alert(`${date}\n\n${titles}`);
  });

  refresh();
});
