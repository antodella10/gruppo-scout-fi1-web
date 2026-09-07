/* Shared local storage helpers for staff + calendar data.
   Note: data lives in the browser for now. For multi-device sync
   we can later move to Firebase/Supabase. */

const ScoutStore = (() => {
  const KEYS = {
    users: "firenze1_staff_users",
    session: "firenze1_staff_session",
    events: "firenze1_activity_events",
    settings: "firenze1_settings",
  };

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

  function getSession() {
    return read(KEYS.session, null);
  }

  function setSession(user) {
    if (!user) {
      localStorage.removeItem(KEYS.session);
      return;
    }
    write(KEYS.session, {
      id: user.id,
      nome: user.nome,
      cognome: user.cognome,
      email: user.email,
    });
  }

  function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    return getUsers().find((u) => u.id === session.id) || null;
  }

  async function registerStaff({ nome, cognome, email, password }) {
    const users = getUsers();
    const normalized = email.trim().toLowerCase();
    if (users.some((u) => u.email === normalized)) {
      throw new Error("Esiste già un account con questa email.");
    }
    if (password.length < 6) {
      throw new Error("La password deve avere almeno 6 caratteri.");
    }
    const user = {
      id: uid("staff"),
      nome: nome.trim(),
      cognome: cognome.trim(),
      email: normalized,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    saveUsers(users);
    setSession(user);
    return user;
  }

  async function loginStaff({ email, password }) {
    const users = getUsers();
    const normalized = email.trim().toLowerCase();
    const user = users.find((u) => u.email === normalized);
    if (!user) throw new Error("Email o password non corretti.");
    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) throw new Error("Email o password non corretti.");
    setSession(user);
    return user;
  }

  function logout() {
    setSession(null);
  }

  function getEvents() {
    return read(KEYS.events, []).sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));
  }

  function saveEvents(events) {
    write(KEYS.events, events);
  }

  function addEvent(event) {
    const events = getEvents();
    const item = {
      id: uid("evt"),
      title: event.title.trim(),
      date: event.date,
      time: event.time || "",
      place: event.place?.trim() || "",
      notes: event.notes?.trim() || "",
      createdBy: event.createdBy || null,
      createdAt: new Date().toISOString(),
    };
    events.push(item);
    saveEvents(events);
    return item;
  }

  function updateEvent(id, patch) {
    const events = getEvents();
    const idx = events.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    events[idx] = { ...events[idx], ...patch };
    saveEvents(events);
    return events[idx];
  }

  function deleteEvent(id) {
    saveEvents(getEvents().filter((e) => e.id !== id));
  }

  function getSettings() {
    return read(KEYS.settings, {
      googleCalendarEmbed: "",
    });
  }

  function saveSettings(settings) {
    write(KEYS.settings, { ...getSettings(), ...settings });
  }

  return {
    registerStaff,
    loginStaff,
    logout,
    getCurrentUser,
    getSession,
    getEvents,
    addEvent,
    updateEvent,
    deleteEvent,
    getSettings,
    saveSettings,
  };
})();
