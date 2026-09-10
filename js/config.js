window.SCOUT_CONFIG = {
  adminEmail: "scoutfirenze1ms@gmail.com",
  /**
   * Chiave scrittura sync (account staff + canzoniere cloud).
   * Deve coincidere con la env Netlify SCOUT_WRITE_KEY se la imposti;
   * altrimenti resta questo valore di default.
   */
  syncWriteKey: "firenze1-ms-sync",
  homeCalendarEmbed: "",
  /** Opzionale: chiave API Google Calendar (alternativa alla function Netlify). */
  googleCalendarApiKey: "",
  association: "FederScout — Associazione Marliani Silvano",
  /** Form Google per le iscrizioni (modificabile anche dall’area admin). */
  iscrizioniFormUrl:
    "https://docs.google.com/forms/d/e/1FAIpQLSdfLeglaOITCcvyqEH5fgVqTV_WiSh9safZ8vXP9GfrBtXOQw/viewform",
  sedi: [
    {
      id: "girone",
      name: "Girone",
      blurb:
        "Sede di Girone: uno dei punti di ritrovo del gruppo per riunioni e attività. Apri la mappa per le indicazioni.",
      mapsUrl: "https://maps.app.goo.gl/UdYqCGBqoHMPbJ1v7",
    },
    {
      id: "quarate",
      name: "Quarate",
      blurb:
        "Sede di Quarate: l’altra casa del Firenze 1. Qui si svolgono incontri e momenti di branca. Apri la mappa per arrivarci.",
      mapsUrl: "https://maps.app.goo.gl/vZ8S7TNm4LQBSBT26",
    },
  ],
  /** Valori di default; aggiornabili dall’area admin (anche i nomi). */
  social: {
    facebook: {
      url: "https://www.facebook.com/scoutfirenze1/?locale=it_IT",
      label: "Facebook",
    },
    instagram: {
      gruppo: { url: "https://www.instagram.com/scout_firenze1", label: "Firenze 1" },
      branco: { url: "https://www.instagram.com/tigerandcavalloni", label: "Branco" },
      reparto: { url: "https://www.instagram.com/riparto.fi1", label: "Reparto" },
      noviziato: { url: "", label: "Noviziato" },
      clan: { url: "", label: "Clan" },
    },
    /** Quale Instagram usare sull’icona “Seguici” in home. */
    homeInstagram: "reparto",
  },
};

window.SCOUT_BRANCHES = {
  branco: { id: "branco", label: "Branco", short: "Branco" },
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

/** Branco + Reparto, ciascuno diviso Girone / Quarate. */
window.SCOUT_DEFAULT_MEETING_HOURS = [
  {
    id: "branco-girone",
    label: "Branco — Girone",
    branca: "branco",
    day: "Sabato",
    time: "15:30–17:00",
    place: "Girone",
  },
  {
    id: "branco-quarate",
    label: "Branco — Quarate",
    branca: "branco",
    day: "Sabato",
    time: "15:30–17:00",
    place: "Quarate",
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
