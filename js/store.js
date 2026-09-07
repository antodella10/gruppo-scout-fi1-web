/* Storage: staff accounts, OTP verification, scoped events.
   Data is local to the browser for now. */

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

  function otpCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
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
      branca: user.branca || null,
      isAdmin: !!user.isAdmin,
    });
  }

  function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    const user = getUsers().find((u) => u.id === session.id);
    if (!user || !user.verified) return null;
    return user;
  }

  function branchLabel(id) {
    return window.SCOUT_BRANCHES?.[id]?.label || id || "";
  }

  function scopeLabel(scope, branca) {
    if (scope === "branca") return branchLabel(branca) || "Branca";
    if (scope === "staff") return `Staff ${branchLabel(branca)}`.trim();
    if (scope === "coca") return "Co.Ca.";
    return "Gruppo";
  }

  /** Start registration: admin auto-verified; others need OTP emailed to group mail. */
  async function registerStaff({ nome, cognome, email, password, branca }) {
    const users = getUsers();
    const pending = getPending();
    const normalized = email.trim().toLowerCase();

    if (!window.SCOUT_BRANCHES?.[branca] && !isAdminEmail(normalized)) {
      throw new Error("Seleziona una branca valida.");
    }
    if (password.length < 6) {
      throw new Error("La password deve avere almeno 6 caratteri.");
    }
    if (users.some((u) => u.email === normalized)) {
      throw new Error("Esiste già un account con questa email.");
    }
    if (pending.some((u) => u.email === normalized)) {
      throw new Error("C’è già una registrazione in attesa per questa email. Completa la verifica OTP.");
    }

    const passwordHash = await hashPassword(password);
    const base = {
      id: uid("staff"),
      nome: nome.trim(),
      cognome: cognome.trim(),
      email: normalized,
      branca: isAdminEmail(normalized) ? branca || "reparto" : branca,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    if (isAdminEmail(normalized)) {
      const user = {
        ...base,
        verified: true,
        isAdmin: true,
        branca: branca || "reparto",
      };
      users.push(user);
      saveUsers(users);
      setSession(user);
      return { user, needsOtp: false };
    }

    const otp = otpCode();
    const pendingUser = {
      ...base,
      otp,
      otpExpires: Date.now() + 1000 * 60 * 60 * 24,
      verified: false,
      isAdmin: false,
    };
    pending.push(pendingUser);
    savePending(pending);

    return { user: pendingUser, needsOtp: true, otp };
  }

  function buildOtpMailto(pendingUser) {
    const to = ADMIN_EMAIL();
    const subject = encodeURIComponent(
      `[Firenze 1] Verifica staff: ${pendingUser.nome} ${pendingUser.cognome}`
    );
    const body = encodeURIComponent(
      `Nuova richiesta account staff\n\n` +
        `Nome: ${pendingUser.nome} ${pendingUser.cognome}\n` +
        `Email: ${pendingUser.email}\n` +
        `Branca: ${branchLabel(pendingUser.branca)}\n` +
        `Codice OTP: ${pendingUser.otp}\n\n` +
        `Se approvi, comunica questo codice alla persona (rispondi alla sua email).\n` +
        `Il codice scade entro 24 ore.`
    );
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }

  async function verifyOtp({ email, otp }) {
    const normalized = email.trim().toLowerCase();
    const code = String(otp || "").trim();
    const pending = getPending();
    const idx = pending.findIndex((u) => u.email === normalized);
    if (idx < 0) throw new Error("Nessuna registrazione in attesa per questa email.");
    const item = pending[idx];
    if (Date.now() > item.otpExpires) {
      pending.splice(idx, 1);
      savePending(pending);
      throw new Error("OTP scaduto. Registrati di nuovo.");
    }
    if (item.otp !== code) throw new Error("Codice OTP non valido.");

    const users = getUsers();
    const user = {
      id: item.id,
      nome: item.nome,
      cognome: item.cognome,
      email: item.email,
      branca: item.branca,
      passwordHash: item.passwordHash,
      createdAt: item.createdAt,
      verified: true,
      isAdmin: isAdminEmail(item.email),
    };
    users.push(user);
    saveUsers(users);
    pending.splice(idx, 1);
    savePending(pending);
    setSession(user);
    return user;
  }

  async function loginStaff({ email, password }) {
    const users = getUsers();
    const pending = getPending();
    const normalized = email.trim().toLowerCase();
    if (pending.some((u) => u.email === normalized)) {
      throw new Error("Account in attesa di verifica OTP. Controlla con la mail di gruppo.");
    }
    const user = users.find((u) => u.email === normalized);
    if (!user) throw new Error("Email o password non corretti.");
    if (!user.verified) throw new Error("Account non ancora verificato.");
    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) throw new Error("Email o password non corretti.");
    // refresh admin flag
    user.isAdmin = isAdminEmail(user.email);
    saveUsers(users.map((u) => (u.id === user.id ? user : u)));
    setSession(user);
    return user;
  }

  function logout() {
    setSession(null);
  }

  function getEvents() {
    return read(KEYS.events, []).sort(
      (a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || "")
    );
  }

  function saveEvents(events) {
    write(KEYS.events, events);
  }

  function canManageEvent(user, event) {
    if (!user) return false;
    if (user.isAdmin || isAdminEmail(user.email)) return true;
    if (event.scope === "coca") return true;
    if (event.scope === "gruppo") return true;
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

    let branca = null;
    if (scope === "branca" || scope === "staff") {
      branca = user.isAdmin && event.branca ? event.branca : user.branca;
      if (!branca) throw new Error("Branca mancante per questo tipo di evento.");
      if (!user.isAdmin && branca !== user.branca) {
        throw new Error("Puoi gestire solo eventi della tua branca.");
      }
    }

    if (scope === "coca" || scope === "gruppo") {
      branca = null;
    }

    return {
      title: String(event.title || "").trim(),
      date: event.date,
      time: event.time || "",
      place: String(event.place || "").trim(),
      notes: String(event.notes || "").trim(),
      scope,
      branca,
    };
  }

  function addEvent(event, user) {
    if (!user) throw new Error("Devi essere autenticato.");
    const data = normalizeEventInput(event, user);
    if (!data.title || !data.date) throw new Error("Titolo e data sono obbligatori.");
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
    events[idx] = {
      ...current,
      ...merged,
      updatedAt: new Date().toISOString(),
    };
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

  /** Home visibility rules */
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

  /** Events a staff member can manage in their panel */
  function getManageableEvents(user) {
    if (!user) return [];
    return getEvents().filter((e) => canManageEvent(user, e));
  }

  function getSettings() {
    return read(KEYS.settings, {
      googleCalendarEmbed: "",
    });
  }

  function saveSettings(settings, user) {
    if (!user || !(user.isAdmin || isAdminEmail(user.email))) {
      throw new Error("Solo l’account mail di gruppo può modificare queste impostazioni.");
    }
    write(KEYS.settings, { ...getSettings(), ...settings });
  }

  return {
    ADMIN_EMAIL,
    isAdminEmail,
    branchLabel,
    scopeLabel,
    registerStaff,
    buildOtpMailto,
    verifyOtp,
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
  };
})();
