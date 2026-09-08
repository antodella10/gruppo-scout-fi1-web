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
  social: {
    facebook: "", // es. https://www.facebook.com/tuapagina
    instagram: {
      gruppo: "",
      lupetti: "",
      reparto: "",
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

window.SCOUT_DEFAULT_MEETING_HOURS = [
  { branca: "lupetti", day: "Sabato", time: "15:30–17:00", place: "Girone" },
  { branca: "reparto", day: "Sabato", time: "15:00–17:30", place: "Girone" },
  { branca: "noviziato", day: "Sabato", time: "15:30–17:30", place: "Quarate" },
  { branca: "clan", day: "Sabato", time: "21:00–23:00", place: "Quarate" },
];
