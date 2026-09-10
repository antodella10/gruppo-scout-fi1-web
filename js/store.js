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
    if (!globalThis.crypto?.subtle?.digest) {
      throw new Error(
        "Questo browser non supporta l’accesso sicuro. Apri il sito da HTTPS (es. Netlify), non da file locale."
      );
    }
    try {
      const data = new TextEncoder().encode(password);
      const digest = await crypto.subtle.digest("SHA-256", data);
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      throw new Error(
        "Impossibile calcolare la password su questo dispositivo. Riprova da Chrome/Safari aggiornato su HTTPS."
      );
    }
  }

  async function pushRemoteAccounts() {
    if (typeof CloudSync === "undefined") return;
    await CloudSync.putAccounts(getUsers(), getPending());
  }

  /** Scarica account dal cloud (così login funziona anche da un altro telefono/PC). */
  async function pullRemoteAccounts() {
    if (typeof CloudSync === "undefined") return false;
    const remote = await CloudSync.getAccounts();
    if (!remote) return false;
    const remoteUsers = Array.isArray(remote.users) ? remote.users : [];
    const remotePending = Array.isArray(remote.pending) ? remote.pending : [];
    if (remoteUsers.length || remotePending.length) {
      saveUsers(remoteUsers);
      savePending(remotePending);
      return true;
    }
    const localUsers = getUsers();
    const localPending = getPending();
    if (localUsers.length || localPending.length) {
      await CloudSync.putAccounts(localUsers, localPending);
    }
    return false;
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
      await pushRemoteAccounts();
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
    await pushRemoteAccounts();
    return { user: pendingUser, pendingApproval: true };
  }

  function listPending(adminUser) {
    if (!isAdminUser(adminUser)) throw new Error("Solo l’admin può vedere le richieste.");
    return getPending().sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  }

  async function approvePending(pendingId, adminUser) {
    if (!isAdminUser(adminUser)) throw new Error("Solo l’admin può approvare.");
    const pending = getPending();
    const idx = pending.findIndex((u) => u.id === pendingId);
    if (idx < 0) throw new Error("Richiesta non trovata.");
    const item = pending[idx];
    const users = getUsers();
    if (users.some((u) => u.email === item.email)) {
      pending.splice(idx, 1);
      savePending(pending);
      await pushRemoteAccounts();
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
    await pushRemoteAccounts();
    return user;
  }

  async function rejectPending(pendingId, adminUser) {
    if (!isAdminUser(adminUser)) throw new Error("Solo l’admin può rifiutare.");
    savePending(getPending().filter((u) => u.id !== pendingId));
    await pushRemoteAccounts();
  }

  async function loginStaff({ email, password }) {
    await pullRemoteAccounts();
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
    await pushRemoteAccounts();
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
      social: raw.social && typeof raw.social === "object" ? raw.social : null,
      iscrizioniFormUrl: String(raw.iscrizioniFormUrl || "").trim(),
    };
  }

  function saveSettings(settings, user) {
    if (!isAdminUser(user)) {
      throw new Error("Solo l’account mail di gruppo può modificare queste impostazioni.");
    }
    write(KEYS.settings, { ...getSettings(), ...settings });
    pushRemoteSettings().catch(() => {});
  }

  async function pushRemoteSettings() {
    if (typeof CloudSync === "undefined") return;
    const s = getSettings();
    await CloudSync.putSettings({
      iscrizioniFormUrl: getIscrizioniFormUrl(),
      social: s.social,
      meetingHours: getMeetingHours(),
      googleCalendars: listGoogleCalendars(),
    });
  }

  async function pullRemoteSettings() {
    if (typeof CloudSync === "undefined") return false;
    const remote = await CloudSync.getSettings();
    if (!remote) return false;
    const has =
      remote.iscrizioniFormUrl ||
      remote.social ||
      (Array.isArray(remote.meetingHours) && remote.meetingHours.length) ||
      (Array.isArray(remote.googleCalendars) && remote.googleCalendars.length);
    if (!has) {
      const local = getSettings();
      if (
        getIscrizioniFormUrl() ||
        local.social ||
        (local.meetingHours || []).length ||
        (local.googleCalendars || []).length
      ) {
        await pushRemoteSettings();
      }
      return false;
    }
    const next = { ...getSettings() };
    if (remote.iscrizioniFormUrl) next.iscrizioniFormUrl = remote.iscrizioniFormUrl;
    if (remote.social) next.social = remote.social;
    if (Array.isArray(remote.meetingHours) && remote.meetingHours.length) {
      next.meetingHours = remote.meetingHours;
    }
    // Non sovrascrivere calendari locali con un array cloud vuoto
    if (Array.isArray(remote.googleCalendars) && remote.googleCalendars.length) {
      next.googleCalendars = remote.googleCalendars;
    } else if ((next.googleCalendars || []).length) {
      pushRemoteSettings().catch(() => {});
    }
    write(KEYS.settings, next);
    return true;
  }

  function listGoogleCalendars() {
    return getSettings().googleCalendars || [];
  }

  function addGoogleCalendar({ branca, embedUrl, color }, user) {
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
    const colorHex = String(color || "").trim();
    const settings = getSettings();
    const list = [...(settings.googleCalendars || [])];
    list.push({
      id: uid("gcal"),
      branca: key,
      calendarId,
      color: colorHex || "#a4bdfc",
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
      id: h.id,
      label: h.label || h.id,
      branca: h.branca,
      day: h.day || "",
      time: h.time || "",
      place: h.place || "",
    }));
  }

  function migrateSavedMeetingHours(saved) {
    if (!Array.isArray(saved) || !saved.length) return [];
    return saved
      .map((h) => {
        if (!h) return null;
        if (h.id) {
          const id = h.id === "lupetti" ? "lupetti-girone" : h.id;
          const label =
            h.id === "lupetti" ? "Lupetti — Girone" : h.label || id;
          return {
            id,
            label,
            branca: h.branca || "",
            day: h.day || "",
            time: h.time || "",
            place: h.place || "",
          };
        }
        // vecchio formato per sola branca
        // vecchio formato / id unificato lupetti
        if (h.branca === "lupetti" || h.id === "lupetti") {
          return {
            id: "lupetti-girone",
            label: "Lupetti — Girone",
            branca: "lupetti",
            day: h.day || "",
            time: h.time || "",
            place: h.place || "Girone",
          };
        }
        if (h.branca === "reparto") {
          return {
            id: "reparto-girone",
            label: "Reparto — Girone",
            branca: "reparto",
            day: h.day || "",
            time: h.time || "",
            place: h.place || "Girone",
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  function getMeetingHours() {
    const settings = getSettings();
    const saved = migrateSavedMeetingHours(settings.meetingHours);
    const byId = Object.fromEntries(saved.map((h) => [h.id, h]));
    return defaultMeetingHours().map((def) => {
      const cur = byId[def.id] || {};
      return {
        id: def.id,
        label: def.label,
        branca: def.branca,
        day: cur.day ?? def.day,
        time: cur.time ?? def.time,
        place: cur.place ?? def.place,
      };
    });
  }

  function canEditMeetingSlot(user, slot) {
    if (!user || !slot) return false;
    if (isAdminUser(user)) return true;
    return !!user.branca && user.branca === slot.branca;
  }

  function saveMeetingHours(list, user) {
    if (!user) throw new Error("Devi essere autenticato.");
    const admin = isAdminUser(user);
    const current = getMeetingHours();
    const incoming = Array.isArray(list) ? list : [];
    const next = current.map((row) => {
      const patch = incoming.find((h) => h.id === row.id);
      if (!patch) return row;
      if (!canEditMeetingSlot(user, row)) return row;
      return {
        id: row.id,
        label: row.label,
        branca: row.branca,
        day: String(patch.day || "").trim(),
        time: String(patch.time || "").trim(),
        place: String(patch.place || "").trim(),
      };
    });
    if (!admin) {
      const editable = incoming.filter((h) => {
        const row = current.find((r) => r.id === h.id);
        return row && canEditMeetingSlot(user, row);
      });
      if (!editable.length) throw new Error("Nessun orario da salvare.");
    }
    write(KEYS.settings, { ...getSettings(), meetingHours: next });
    pushRemoteSettings().catch(() => {});
    return next;
  }

  function normalizeSocialEntry(raw, fallbackUrl, fallbackLabel) {
    if (raw && typeof raw === "object") {
      return {
        url: String(raw.url || "").trim(),
        label: String(raw.label || fallbackLabel || "").trim() || fallbackLabel,
      };
    }
    const url = String(raw || fallbackUrl || "").trim();
    return { url, label: fallbackLabel };
  }

  function defaultSocial() {
    const cfg = window.SCOUT_CONFIG?.social || {};
    const fbCfg = cfg.facebook;
    const fbFallback =
      typeof fbCfg === "string" ? fbCfg : fbCfg?.url || "";
    const fbLabel =
      typeof fbCfg === "object" && fbCfg?.label ? fbCfg.label : "Facebook";
    const igCfg = cfg.instagram || {};
    const pickIg = (id, label) => {
      const item = igCfg[id];
      if (item && typeof item === "object") {
        return {
          url: String(item.url || "").trim(),
          label: String(item.label || label).trim() || label,
        };
      }
      return { url: String(item || "").trim(), label };
    };
    return {
      facebook: { url: String(fbFallback).trim(), label: fbLabel },
      instagram: {
        gruppo: pickIg("gruppo", "Firenze 1"),
        lupetti: pickIg("lupetti", "Lupetti"),
        reparto: pickIg("reparto", "Reparto"),
        noviziato: pickIg("noviziato", "Noviziato"),
        clan: pickIg("clan", "Clan"),
      },
      homeInstagram: String(cfg.homeInstagram || "reparto"),
    };
  }

  function getSocialLinks() {
    const base = defaultSocial();
    const saved = getSettings().social;
    if (!saved || typeof saved !== "object") return base;

    const fb = normalizeSocialEntry(
      saved.facebook ?? base.facebook,
      base.facebook.url,
      base.facebook.label
    );
    if (!fb.url && base.facebook.url) fb.url = base.facebook.url;

    const mergeIg = (id) => {
      const fromSaved = saved.instagram?.[id];
      const fromBase = base.instagram[id];
      const entry = normalizeSocialEntry(fromSaved ?? fromBase, fromBase.url, fromBase.label);
      if (!entry.url && fromBase.url) entry.url = fromBase.url;
      if (!entry.label) entry.label = fromBase.label;
      return entry;
    };

    const homeInstagram = String(saved.homeInstagram || base.homeInstagram || "reparto");
    return {
      facebook: fb,
      instagram: {
        gruppo: mergeIg("gruppo"),
        lupetti: mergeIg("lupetti"),
        reparto: mergeIg("reparto"),
        noviziato: mergeIg("noviziato"),
        clan: mergeIg("clan"),
      },
      homeInstagram,
    };
  }

  function saveSocialLinks(social, user) {
    if (!isAdminUser(user)) throw new Error("Solo admin può aggiornare i social.");
    const next = {
      facebook: {
        url: String(social?.facebook?.url ?? social?.facebook ?? "").trim(),
        label: String(social?.facebook?.label || "Facebook").trim() || "Facebook",
      },
      instagram: {
        gruppo: {
          url: String(social?.instagram?.gruppo?.url ?? social?.instagram?.gruppo ?? "").trim(),
          label: String(social?.instagram?.gruppo?.label || "Firenze 1").trim() || "Firenze 1",
        },
        lupetti: {
          url: String(social?.instagram?.lupetti?.url ?? social?.instagram?.lupetti ?? "").trim(),
          label: String(social?.instagram?.lupetti?.label || "Lupetti").trim() || "Lupetti",
        },
        reparto: {
          url: String(social?.instagram?.reparto?.url ?? social?.instagram?.reparto ?? "").trim(),
          label: String(social?.instagram?.reparto?.label || "Reparto").trim() || "Reparto",
        },
        noviziato: {
          url: String(social?.instagram?.noviziato?.url ?? social?.instagram?.noviziato ?? "").trim(),
          label: String(social?.instagram?.noviziato?.label || "Noviziato").trim() || "Noviziato",
        },
        clan: {
          url: String(social?.instagram?.clan?.url ?? social?.instagram?.clan ?? "").trim(),
          label: String(social?.instagram?.clan?.label || "Clan").trim() || "Clan",
        },
      },
      homeInstagram: String(social?.homeInstagram || "reparto"),
    };
    write(KEYS.settings, { ...getSettings(), social: next });
    pushRemoteSettings().catch(() => {});
    return next;
  }

  function getIscrizioniFormUrl() {
    const saved = getSettings().iscrizioniFormUrl;
    if (saved) return saved;
    return String(window.SCOUT_CONFIG?.iscrizioniFormUrl || "").trim();
  }

  function saveIscrizioniFormUrl(url, user) {
    if (!isAdminUser(user)) throw new Error("Solo l’admin può aggiornare il form iscrizioni.");
    const clean = String(url || "").trim();
    if (clean && !/^https?:\/\//i.test(clean)) {
      throw new Error("Incolla un URL completo (https://…).");
    }
    write(KEYS.settings, { ...getSettings(), iscrizioniFormUrl: clean });
    pushRemoteSettings().catch(() => {});
    return clean;
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
    pullRemoteAccounts,
    pushRemoteAccounts,
    pullRemoteSettings,
    pushRemoteSettings,
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
    canEditMeetingSlot,
    getSocialLinks,
    saveSocialLinks,
    getIscrizioniFormUrl,
    saveIscrizioniFormUrl,
  };
})();
