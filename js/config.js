window.SCOUT_CONFIG = {
  adminEmail: "scoutfirenze1ms@gmail.com",
  homeCalendarEmbed: "",
  /** Opzionale: chiave API Google Calendar (alternativa alla function Netlify). */
  googleCalendarApiKey: "",
  association: "FederScout — Associazione Mariano Silvani",
  /** Form Google per le iscrizioni (sostituisci con il link reale). */
  iscrizioniFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSf_PLACEHOLDER/viewform",
  sedi: [
    {
      id: "girone",
      name: "Girone",
      blurb: "Sede di Girone — apri la mappa per indicazioni.",
      mapsUrl: "https://maps.app.goo.gl/UdYqCGBqoHMPbJ1v7",
    },
    {
      id: "quarate",
      name: "Quarate",
      blurb: "Sede di Quarate — apri la mappa per indicazioni.",
      mapsUrl: "https://maps.app.goo.gl/vZ8S7TNm4LQBSBT26",
    },
  ],
  /** Valori di default; in produzione si possono aggiornare dall’area admin. */
  social: {
    facebook: "https://www.facebook.com/scoutfirenze1/?locale=it_IT",
    instagram: {
      gruppo: "https://www.instagram.com/scout_firenze1",
      lupetti: "https://www.instagram.com/tigerandcavalloni",
      reparto: "https://www.instagram.com/riparto.fi1",
      noviziato: "",
      clan: "",
    },
  },
};

window.SCOUT_BRANCHES = {
  lupetti: { id: "lupetti", label: "Lupetti", short: "Lupetti" },
  reparto: { id: "reparto", label: "Reparto", short: "Reparto" },
  noviziato: { id: "noviziato", label: "Noviziato", short: "Noviziato" },
  clan: { id: "clan", label: "Clan", short: "Clan" },
};

window.SCOUT_SCOPES = {
  gruppo: { id: "gruppo", label: "Gruppo" },
  branca: { id: "branca", label: "Branca" },
  staff: { id: "staff", label: "Staff" },
  coca: { id: "coca", label: "Co.Ca." },
};

/** Solo lupetti + reparto (Girone / Quarate). */
window.SCOUT_DEFAULT_MEETING_HOURS = [
  {
    id: "lupetti",
    label: "Lupetti",
    branca: "lupetti",
    day: "Sabato",
    time: "15:30–17:00",
    place: "Girone",
  },
  {
    id: "reparto-girone",
    label: "Reparto — Girone",
    branca: "reparto",
    day: "Sabato",
    time: "15:00–17:30",
    place: "Girone",
  },
  {
    id: "reparto-quarate",
    label: "Reparto — Quarate",
    branca: "reparto",
    day: "Sabato",
    time: "15:00–17:30",
    place: "Quarate",
  },
];
