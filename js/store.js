/* Storage: staff accounts, admin approval, scoped events. */

const ScoutStore = (() => {
  const KEYS = {
    users: "firenze1_staff_users_v2",
    session: "firenze1_staff_session_v2",
    events: "firenze1_activity_events_v2",
    settings: "firenze1_settings_v2",
    pending: "firenze1_pending_staff_v2",
  };

  const ADMIN_EMAIL = () =>
    (window.SCOUT_CONFIG?.adminEmail || "scoutfirenze1ms@gmail.com").toLowerCase();

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }

  async function hashPassword(password) {
    const data = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function getUsers() {
    return read(KEYS.users, []);
  }

  function saveUsers(users) {
    write(KEYS.users, users);
  }

  function getPending() {
    return read(KEYS.pending, []);
  }

  function savePending(list) {
    write(KEYS.pending, list);
  }

  function isAdminEmail(email) {
    return String(email || "").trim().toLowerCase() === ADMIN_EMAIL();
  }

  function isAdminUser(user) {
    return !!(user && (user.isAdmin || isAdminEmail(user.email)));
  }

  function getSession() {
    return read(KEYS.session, null);
  }

  function setSession(user) {
    if (!user) {
      localStorage.removeItem(KEYS.session);
      return;
    }
    const admin = isAdminUser(user);
    write(KEYS.session, {
      id: user.id,
      nome: user.nome,
      cognome: user.cognome,
      email: user.email,
      branca: admin ? null : user.branca || null,
      isAdmin: admin,
    });
  }

  function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    const user = getUsers().find((u) => u.id === session.id);
    if (!user || !user.verified) return null;
    if (isAdminEmail(user.email)) {
      user.isAdmin = true;
      user.branca = null;
    }
    return user;
  }

  function branchLabel(id) {
    return window.SCOUT_BRANCHES?.[id]?.label || id || "";
  }

  function scopeLabel(scope, branca) {
    if (scope === "google") {
      if (branca && window.SCOUT_BRANCHES?.[branca]) {
        return `Google · ${branchLabel(branca)}`;
      }
      return "Google";
    }
    if (scope === "branca") return branchLabel(branca) || "Branca";
    if (scope === "staff") return `Staff ${branchLabel(branca)}`.trim();
    if (scope === "coca") return "Co.Ca.";
    return "Gruppo";
  }

  /** Admin: no branca. Others: pending until admin approves. */
  async function registerStaff({ nome, cognome, email, password, branca }) {
    const users = getUsers();
    const pending = getPending();
    const normalized = email.trim().toLowerCase();

    if (password.length < 6) {
      throw new Error("La password deve avere almeno 6 caratteri.");
    }
    if (users.some((u) => u.email === normalized)) {
      throw new Error("Esiste già un account con questa email.");
    }
    if (pending.some((u) => u.email === normalized)) {
      throw new Error("C’è già una richiesta in attesa di approvazione per questa email.");
    }

    if (isAdminEmail(normalized)) {
      const user = {
        id: uid("staff"),
        nome: nome.trim(),
        cognome: cognome.trim(),
        email: normalized,
        branca: null,
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
        verified: true,
        isAdmin: true,
      };
      users.push(user);
      saveUsers(users);
      setSession(user);
      return { user, pendingApproval: false };
    }

    if (!window.SCOUT_BRANCHES?.[branca]) {
      throw new Error("Seleziona una branca valida.");
    }

    const pendingUser = {
      id: uid("staff"),
      nome: nome.trim(),
      cognome: cognome.trim(),
      email: normalized,
      branca,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
      verified: false,
      isAdmin: false,
    };
    pending.push(pendingUser);
    savePending(pending);
    return { user: pendingUser, pendingApproval: true };
  }

  function listPending(adminUser) {
    if (!isAdminUser(adminUser)) throw new Error("Solo l’admin può vedere le richieste.");
    return getPending().sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  }

  function approvePending(pendingId, adminUser) {
    if (!isAdminUser(adminUser)) throw new Error("Solo l’admin può approvare.");
    const pending = getPending();
    const idx = pending.findIndex((u) => u.id === pendingId);
    if (idx < 0) throw new Error("Richiesta non trovata.");
    const item = pending[idx];
    const users = getUsers();
    if (users.some((u) => u.email === item.email)) {
      pending.splice(idx, 1);
      savePending(pending);
      throw new Error("Questa email è già registrata.");
    }
    const user = {
      id: item.id,
      nome: item.nome,
      cognome: item.cognome,
      email: item.email,
      branca: item.branca,
      passwordHash: item.passwordHash,
      createdAt: item.createdAt,
      verified: true,
      isAdmin: false,
      approvedAt: new Date().toISOString(),
      approvedBy: adminUser.id,
    };
    users.push(user);
    saveUsers(users);
    pending.splice(idx, 1);
    savePending(pending);
    return user;
  }

  function rejectPending(pendingId, adminUser) {
    if (!isAdminUser(adminUser)) throw new Error("Solo l’admin può rifiutare.");
    savePending(getPending().filter((u) => u.id !== pendingId));
  }

  async function loginStaff({ email, password }) {
    const users = getUsers();
    const pending = getPending();
    const normalized = email.trim().toLowerCase();
    if (pending.some((u) => u.email === normalized)) {
      throw new Error("Account in attesa di approvazione da parte dell’admin.");
    }
    const user = users.find((u) => u.email === normalized);
    if (!user) throw new Error("Email o password non corretti.");
    if (!user.verified) throw new Error("Account non ancora approvato.");
    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) throw new Error("Email o password non corretti.");

    if (isAdminEmail(user.email)) {
      user.isAdmin = true;
      user.branca = null;
    } else {
      user.isAdmin = false;
    }
    saveUsers(users.map((u) => (u.id === user.id ? user : u)));
    setSession(user);
    return user;
  }

  function logout() {
    setSession(null);
  }

  function getEvents() {
    const raw = read(KEYS.events, []);
    const normalized = raw.map((e) => {
      const dateStart = e.dateStart || e.date || "";
      const dateEnd = e.dateEnd || e.dateStart || e.date || dateStart;
      return {
        ...e,
        dateStart,
        dateEnd,
        date: dateStart, // compat
        allDay: !!e.allDay,
        description: e.description || e.notes || "",
        notes: e.description || e.notes || "",
      };
    });
    return normalized.sort(
      (a, b) =>
        a.dateStart.localeCompare(b.dateStart) ||
        (a.time || "").localeCompare(b.time || "")
    );
  }

  function saveEvents(events) {
    write(KEYS.events, events);
  }

  function canManageEvent(user, event) {
    if (!user) return false;
    if (isAdminUser(user)) return true;
    if (event.scope === "coca" || event.scope === "gruppo") return true;
    if ((event.scope === "branca" || event.scope === "staff") && event.branca === user.branca) {
      return true;
    }
    return false;
  }

  function normalizeEventInput(event, user) {
    const scope = event.scope;
    if (!["gruppo", "branca", "staff", "coca"].includes(scope)) {
      throw new Error("Tipo evento non valido.");
    }

    const admin = isAdminUser(user);
    let branca = null;

    if (scope === "branca" || scope === "staff") {
      branca = admin ? event.branca : user.branca;
      if (!branca || !window.SCOUT_BRANCHES?.[branca]) {
        throw new Error("Seleziona la branca per questo evento.");
      }
      if (!admin && branca !== user.branca) {
        throw new Error("Puoi gestire solo eventi della tua branca.");
      }
    }

    const dateStart = event.dateStart || event.date || "";
    let dateEnd = event.dateEnd || dateStart;
    if (dateEnd && dateStart && dateEnd < dateStart) {
      throw new Error("La data di fine non può essere prima dell’inizio.");
    }
    if (!dateEnd) dateEnd = dateStart;

    const time = String(event.time || "").trim();
    const allDay = event.allDay === true || !time;
    const description = String(event.description ?? event.notes ?? "").trim();

    return {
      title: String(event.title || "").trim(),
      dateStart,
      dateEnd,
      date: dateStart,
      time: allDay ? "" : time,
      allDay,
      place: String(event.place || "").trim(),
      description,
      notes: description,
      scope,
      branca,
    };
  }

  function addEvent(event, user) {
    if (!user) throw new Error("Devi essere autenticato.");
    const data = normalizeEventInput(event, user);
    if (!data.title || !data.dateStart) throw new Error("Titolo e data inizio sono obbligatori.");
    const item = {
      id: uid("evt"),
      ...data,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!canManageEvent(user, item)) throw new Error("Non puoi creare questo tipo di evento.");
    const events = getEvents();
    events.push(item);
    saveEvents(events);
    return item;
  }

  function updateEvent(id, patch, user) {
    if (!user) throw new Error("Devi essere autenticato.");
    const events = getEvents();
    const idx = events.findIndex((e) => e.id === id);
    if (idx < 0) throw new Error("Evento non trovato.");
    const current = events[idx];
    if (!canManageEvent(user, current)) throw new Error("Non puoi modificare questo evento.");
    const merged = normalizeEventInput({ ...current, ...patch }, user);
    if (!canManageEvent(user, merged)) throw new Error("Non puoi impostare questo tipo di evento.");
    events[idx] = { ...current, ...merged, updatedAt: new Date().toISOString() };
    saveEvents(events);
    return events[idx];
  }

  function deleteEvent(id, user) {
    if (!user) throw new Error("Devi essere autenticato.");
    const events = getEvents();
    const item = events.find((e) => e.id === id);
    if (!item) return;
    if (!canManageEvent(user, item)) throw new Error("Non puoi eliminare questo evento.");
    saveEvents(events.filter((e) => e.id !== id));
  }

  function getVisibleEvents(selectedBranca, user) {
    const staff = user && user.verified;
    return getEvents().filter((e) => {
      if (e.scope === "gruppo") return true;
      if (!selectedBranca) return false;
      if (e.scope === "branca" && e.branca === selectedBranca) return true;
      if (staff && e.scope === "coca") return true;
      if (staff && e.scope === "staff" && e.branca === selectedBranca) return true;
      return false;
    });
  }

  function getManageableEvents(user) {
    if (!user) return [];
    return getEvents().filter((e) => canManageEvent(user, e));
  }

  function getSettings() {
    const raw = read(KEYS.settings, {});
    let calendars = Array.isArray(raw.googleCalendars) ? raw.googleCalendars : [];
    // migrazione vecchio singolo embed
    if (!calendars.length && raw.googleCalendarEmbed) {
      const id =
        typeof GoogleCal !== "undefined"
          ? GoogleCal.extractCalendarId(raw.googleCalendarEmbed)
          : "";
      calendars.push({
        id: "legacy_gruppo",
        branca: "gruppo",
        calendarId: id,
        embedUrl: raw.googleCalendarEmbed,
      });
    }
    // backfill calendarId da URL
    calendars = calendars.map((c) => {
      if (c.calendarId) return c;
      const id =
        typeof GoogleCal !== "undefined"
          ? GoogleCal.extractCalendarId(c.embedUrl || "")
          : "";
      return id ? { ...c, calendarId: id } : c;
    });
    return {
      googleCalendars: calendars,
      googleCalendarEmbed: raw.googleCalendarEmbed || "",
      meetingHours: Array.isArray(raw.meetingHours) ? raw.meetingHours : [],
    };
  }

  function saveSettings(settings, user) {
    if (!isAdminUser(user)) {
      throw new Error("Solo l’account mail di gruppo può modificare queste impostazioni.");
    }
    write(KEYS.settings, { ...getSettings(), ...settings });
  }

  function listGoogleCalendars() {
    return getSettings().googleCalendars || [];
  }

  function addGoogleCalendar({ branca, embedUrl }, user) {
    if (!isAdminUser(user)) throw new Error("Solo admin.");
    const raw = String(embedUrl || "").trim();
    const calendarId =
      typeof GoogleCal !== "undefined"
        ? GoogleCal.extractCalendarId(raw)
        : raw;
    if (!calendarId) {
      throw new Error("Incolla l’URL di incorporamento o l’ID del calendario Google.");
    }
    const key = branca === "gruppo" ? "gruppo" : branca;
    if (key !== "gruppo" && !window.SCOUT_BRANCHES?.[key]) {
      throw new Error("Seleziona una branca valida.");
    }
    const settings = getSettings();
    const list = [...(settings.googleCalendars || [])];
    list.push({
      id: uid("gcal"),
      branca: key,
      calendarId,
      embedUrl: raw.includes("://") ? raw : `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}`,
      createdAt: new Date().toISOString(),
    });
    saveSettings({ googleCalendars: list }, user);
    return list;
  }

  function removeGoogleCalendar(id, user) {
    if (!isAdminUser(user)) throw new Error("Solo admin.");
    const settings = getSettings();
    const list = (settings.googleCalendars || []).filter((c) => c.id !== id);
    saveSettings({ googleCalendars: list }, user);
    return list;
  }

  function getGoogleCalendarsForView(selectedBranca) {
    const list = listGoogleCalendars();
    if (!selectedBranca) {
      return list.filter((c) => c.branca === "gruppo");
    }
    return list.filter((c) => c.branca === "gruppo" || c.branca === selectedBranca);
  }

  function defaultMeetingHours() {
    const defaults = window.SCOUT_DEFAULT_MEETING_HOURS || [];
    return defaults.map((h) => ({
      branca: h.branca,
      day: h.day || "",
      time: h.time || "",
      place: h.place || "",
    }));
  }

  function getMeetingHours() {
    const settings = getSettings();
    const saved = Array.isArray(settings.meetingHours) ? settings.meetingHours : [];
    const byBranca = Object.fromEntries(saved.filter((h) => h && h.branca).map((h) => [h.branca, h]));
    const order = Object.keys(window.SCOUT_BRANCHES || {});
    const defaults = defaultMeetingHours();
    const defBy = Object.fromEntries(defaults.map((h) => [h.branca, h]));
    return order.map((id) => {
      const cur = byBranca[id] || defBy[id] || { branca: id, day: "", time: "", place: "" };
      return {
        branca: id,
        day: cur.day || "",
        time: cur.time || "",
        place: cur.place || "",
      };
    });
  }

  function saveMeetingHours(list, user) {
    if (!user) throw new Error("Devi essere autenticato.");
    const admin = isAdminUser(user);
    const current = getMeetingHours();
    const incoming = Array.isArray(list) ? list : [];
    const next = current.map((row) => {
      const patch = incoming.find((h) => h.branca === row.branca);
      if (!patch) return row;
      if (!admin && user.branca !== row.branca) return row;
      return {
        branca: row.branca,
        day: String(patch.day || "").trim(),
        time: String(patch.time || "").trim(),
        place: String(patch.place || "").trim(),
      };
    });
    // staff non admin: può aggiornare solo la propria riga
    if (!admin) {
      if (!user.branca) throw new Error("Branca non impostata.");
      const only = incoming.find((h) => h.branca === user.branca);
      if (!only) throw new Error("Nessun orario da salvare.");
      const merged = current.map((row) =>
        row.branca === user.branca
          ? {
              branca: row.branca,
              day: String(only.day || "").trim(),
              time: String(only.time || "").trim(),
              place: String(only.place || "").trim(),
            }
          : row
      );
      write(KEYS.settings, { ...getSettings(), meetingHours: merged });
      return merged;
    }
    write(KEYS.settings, { ...getSettings(), meetingHours: next });
    return next;
  }

  function updateMeetingHour(branca, patch, user) {
    if (!user) throw new Error("Devi essere autenticato.");
    const admin = isAdminUser(user);
    if (!admin && user.branca !== branca) {
      throw new Error("Puoi modificare solo l’orario della tua branca.");
    }
    if (!window.SCOUT_BRANCHES?.[branca]) throw new Error("Branca non valida.");
    const list = getMeetingHours().map((row) =>
      row.branca === branca
        ? {
            branca,
            day: String(patch.day ?? row.day ?? "").trim(),
            time: String(patch.time ?? row.time ?? "").trim(),
            place: String(patch.place ?? row.place ?? "").trim(),
          }
        : row
    );
    write(KEYS.settings, { ...getSettings(), meetingHours: list });
    return list;
  }

  return {
    ADMIN_EMAIL,
    isAdminEmail,
    isAdminUser,
    branchLabel,
    scopeLabel,
    registerStaff,
    listPending,
    approvePending,
    rejectPending,
    loginStaff,
    logout,
    getCurrentUser,
    getSession,
    getEvents,
    getVisibleEvents,
    getManageableEvents,
    canManageEvent,
    addEvent,
    updateEvent,
    deleteEvent,
    getSettings,
    saveSettings,
    listGoogleCalendars,
    addGoogleCalendar,
    removeGoogleCalendar,
    getGoogleCalendarsForView,
    getMeetingHours,
    saveMeetingHours,
    updateMeetingHour,
  };
})();
