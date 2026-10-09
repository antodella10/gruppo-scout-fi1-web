/* Storage: staff + ragazzi accounts, admin approval, scoped events. */

const ScoutStore = (() => {
  const KEYS = {
    users: "firenze1_staff_users_v2",
    session: "firenze1_staff_session_v2",
    events: "firenze1_activity_events_v2",
    settings: "firenze1_settings_v2",
    pending: "firenze1_pending_staff_v2",
    deletedNotices: "firenze1_deleted_account_notices_v1",
  };

  const ROLE_STAFF = "staff";
  const ROLE_RAGAZZO = "ragazzo";

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

  /** Compat: vecchi id branca → attuali. */
  function normalizeBrancaId(id) {
    if (id === "lupetti") return "branco";
    if (id === "reparto" || id === "Reparto") return "riparto";
    return id || null;
  }

  function normalizeMeetingSlotId(id) {
    if (id === "lupetti" || id === "lupetti-girone") return "branco-girone";
    if (id === "lupetti-quarate") return "branco-quarate";
    if (id === "reparto-girone" || id === "Reparto-girone") return "riparto-girone";
    if (id === "reparto-quarate" || id === "Reparto-quarate") return "riparto-quarate";
    return id;
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
    await CloudSync.putAccounts(getUsers(), getPending(), getDeletedNotices());
  }

  /** Scarica account dal cloud (così login funziona anche da un altro telefono/PC). */
  async function pullRemoteAccounts() {
    if (typeof CloudSync === "undefined") return false;
    const remote = await CloudSync.getAccounts();
    if (!remote) return false;
    const remoteUsers = Array.isArray(remote.users) ? remote.users : [];
    const remotePending = Array.isArray(remote.pending) ? remote.pending : [];
    if (remoteUsers.length || remotePending.length || Array.isArray(remote.deletedNotices)) {
      saveUsers(remoteUsers);
      savePending(remotePending);
      if (Array.isArray(remote.deletedNotices)) {
        saveDeletedNotices(remote.deletedNotices);
      }
      return true;
    }
    const localUsers = getUsers();
    const localPending = getPending();
    const localDeleted = getDeletedNotices();
    if (localUsers.length || localPending.length || localDeleted.length) {
      await CloudSync.putAccounts(localUsers, localPending, localDeleted);
    }
    return false;
  }

  function normalizeAccount(u) {
    if (!u) return u;
    const role = u.role === ROLE_RAGAZZO ? ROLE_RAGAZZO : ROLE_STAFF;
    const email = String(u.email || "").trim().toLowerCase() || null;
    const username = String(u.username || "")
      .trim()
      .toLowerCase() || null;
    return {
      ...u,
      role,
      email,
      username,
      branca: u.branca ? normalizeBrancaId(u.branca) : u.branca || null,
      squadriglia: u.squadriglia || null,
      dataNascita: u.dataNascita || null,
    };
  }

  function getUsers() {
    return read(KEYS.users, []).map(normalizeAccount);
  }

  function saveUsers(users) {
    write(KEYS.users, users);
  }

  function getPending() {
    return read(KEYS.pending, []).map(normalizeAccount);
  }

  function savePending(list) {
    write(KEYS.pending, list);
  }

  function getDeletedNotices() {
    const raw = read(KEYS.deletedNotices, []);
    return Array.isArray(raw) ? raw : [];
  }

  function saveDeletedNotices(list) {
    write(KEYS.deletedNotices, Array.isArray(list) ? list : []);
  }

  function findDeletedNoticeByLogin(login) {
    const key = String(login || "").trim().toLowerCase();
    if (!key) return null;
    return (
      getDeletedNotices().find(
        (n) =>
          (n.email && n.email === key) ||
          (n.username && n.username === key)
      ) || null
    );
  }

  function clearDeletedNoticesForLogin({ email, username } = {}) {
    const mail = String(email || "").trim().toLowerCase();
    const userName = normalizeUsername(username);
    if (!mail && !userName) return;
    const next = getDeletedNotices().filter((n) => {
      if (mail && n.email && n.email === mail) return false;
      if (userName && n.username && n.username === userName) return false;
      return true;
    });
    saveDeletedNotices(next);
  }

  function deletedAccountLoginMessage(notice) {
    const staffMsg = String(notice?.message || "").trim();
    const lines = ["Questo account è stato eliminato."];
    if (staffMsg) lines.push(`Messaggio dello staff: ${staffMsg}`);
    lines.push("Puoi richiedere un nuovo account con la stessa email o username.");
    return lines.join("\n");
  }

  function addDeletedNotice(target, { message, deletedBy } = {}) {
    const email = String(target?.email || "").trim().toLowerCase() || null;
    const username = normalizeUsername(target?.username) || null;
    if (!email && !username) return;
    const rest = getDeletedNotices().filter((n) => {
      if (email && n.email && n.email === email) return false;
      if (username && n.username && n.username === username) return false;
      return true;
    });
    rest.push({
      id: uid("deleted"),
      email,
      username,
      nome: target.nome || "",
      cognome: target.cognome || "",
      role: accountRole(target),
      message: String(message || "").trim().slice(0, 800),
      deletedAt: new Date().toISOString(),
      deletedBy: deletedBy || null,
    });
    saveDeletedNotices(rest);
  }

  function isAdminEmail(email) {
    return String(email || "").trim().toLowerCase() === ADMIN_EMAIL();
  }

  function accountRole(user) {
    if (!user) return null;
    if (user.role === ROLE_RAGAZZO) return ROLE_RAGAZZO;
    return ROLE_STAFF;
  }

  function isRagazzoUser(user) {
    return accountRole(user) === ROLE_RAGAZZO;
  }

  function isStaffUser(user) {
    return !!user && accountRole(user) === ROLE_STAFF;
  }

  function isAdminUser(user) {
    return !!(user && isStaffUser(user) && (user.isAdmin || isAdminEmail(user.email)));
  }

  /** Admin: tutte le richieste. Staff Riparto: solo account ragazzi (Ripartari). */
  function canManageRagazziRequests(user) {
    if (!user || !isStaffUser(user)) return false;
    if (isAdminUser(user)) return true;
    return user.branca === "riparto";
  }

  function canManageStaffRequests(user) {
    return isAdminUser(user);
  }

  function canOpenAccountRequests(user) {
    return canManageStaffRequests(user) || canManageRagazziRequests(user);
  }

  function canManageSentieri(user) {
    return canManageRagazziRequests(user);
  }

  const CLASSI_SENTIERO = [
    { id: "promessa", label: "Promessa", glow: "green" },
    { id: "seconda", label: "Seconda classe", glow: "orange" },
    { id: "prima", label: "Prima classe", glow: "purple" },
    { id: "scelto", label: "Scelto", glow: "rainbow" },
  ];

  function classeIndex(id) {
    return CLASSI_SENTIERO.findIndex((c) => c.id === id);
  }

  function normalizeProgress(user) {
    const classe = CLASSI_SENTIERO.some((c) => c.id === user?.classe) ? user.classe : null;
    const specialita = Array.isArray(user?.specialita)
      ? user.specialita
          .map((s) => ({
            id: String(s.id || ""),
            name: String(s.name || s.title || "").trim() || "Specialità",
            status: s.status === "pending" || s.earned === false ? "pending" : "earned",
          }))
          .filter((s) => s.id)
      : [];
    return { classe, specialita };
  }

  /** Classi ottenute: dalla più recente (sinistra) alla più vecchia (destra). */
  function classiOttenuteDisplay(classeId) {
    const idx = classeIndex(classeId);
    if (idx < 0) return [];
    return CLASSI_SENTIERO.slice(0, idx + 1)
      .slice()
      .reverse()
      .map((c, i) => ({ ...c, isLatest: i === 0 }));
  }

  function getRagazzoProgress(userOrId) {
    const user =
      typeof userOrId === "string" ? getUsers().find((u) => u.id === userOrId) : userOrId;
    if (!user || accountRole(user) !== ROLE_RAGAZZO) return { classe: null, specialita: [] };
    return normalizeProgress(user);
  }

  async function updateRagazzoProgress(ragazzoId, patch, viewer) {
    if (!canManageSentieri(viewer)) {
      throw new Error("Solo staff Riparto o admin possono gestire i sentieri.");
    }
    const users = getUsers();
    const idx = users.findIndex((u) => u.id === ragazzoId && accountRole(u) === ROLE_RAGAZZO);
    if (idx < 0) throw new Error("Account non trovato.");
    const current = normalizeProgress(users[idx]);
    let classe = current.classe;
    if (patch && "classe" in patch) {
      const next = patch.classe;
      if (next === null || next === "") classe = null;
      else if (classeIndex(next) < 0) throw new Error("Classe non valida.");
      else classe = next;
    }
    let specialita = current.specialita;
    if (patch && Array.isArray(patch.specialita)) {
      specialita = patch.specialita.map((s) => ({
        id: String(s.id || uid("specprog")),
        name: String(s.name || "").trim() || "Specialità",
        status: s.status === "pending" ? "pending" : "earned",
      }));
    }
    users[idx] = { ...users[idx], classe, specialita };
    saveUsers(users);
    await pushRemoteAccounts();
    return normalizeProgress(users[idx]);
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
    const role = accountRole(user);
    write(KEYS.session, {
      id: user.id,
      nome: user.nome,
      cognome: user.cognome,
      email: user.email || null,
      username: user.username || null,
      role,
      branca: admin ? null : user.branca || null,
      squadriglia: user.squadriglia || null,
      dataNascita: user.dataNascita || null,
      isAdmin: admin,
    });
  }

  function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    const user = getUsers().find((u) => u.id === session.id);
    if (!user || !user.verified) return null;
    if (isAdminEmail(user.email) && isStaffUser(user)) {
      user.isAdmin = true;
      user.branca = null;
    }
    return user;
  }

  function slugPart(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24);
  }

  function suggestUsername(nome, cognome) {
    const a = slugPart(nome) || "nome";
    const b = slugPart(cognome) || "cognome";
    return `${a}.${b}`;
  }

  function normalizeUsername(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ".");
  }

  function emailTaken(normalized, { excludeId } = {}) {
    if (!normalized) return false;
    const inUsers = getUsers().some((u) => u.email === normalized && u.id !== excludeId);
    const inPending = getPending().some((u) => u.email === normalized && u.id !== excludeId);
    return inUsers || inPending;
  }

  function usernameTaken(normalized, { excludeId } = {}) {
    if (!normalized) return false;
    const inUsers = getUsers().some((u) => u.username === normalized && u.id !== excludeId);
    const inPending = getPending().some((u) => u.username === normalized && u.id !== excludeId);
    return inUsers || inPending;
  }

  function findUserByLogin(login) {
    const key = String(login || "").trim().toLowerCase();
    if (!key) return null;
    return (
      getUsers().find((u) => u.email === key || u.username === key) || null
    );
  }

  function findPendingByLogin(login) {
    const key = String(login || "").trim().toLowerCase();
    if (!key) return null;
    return getPending().find((u) => u.email === key || u.username === key) || null;
  }

  function canOpenSpecialitaPdf(user, specialitaId) {
    if (!user) return false;
    if (isStaffUser(user)) return true;
    if (!isRagazzoUser(user)) return false;
    const progress = normalizeProgress(user);
    return progress.specialita.some((s) => s.id === specialitaId);
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
  async function registerStaff({ nome, cognome, dataNascita, email, password, branca }) {
    const users = getUsers();
    const pending = getPending();
    const normalized = email.trim().toLowerCase();
    const birth = String(dataNascita || "").trim();

    if (password.length < 6) {
      throw new Error("La password deve avere almeno 6 caratteri.");
    }
    if (!nome?.trim() || !cognome?.trim()) {
      throw new Error("Inserisci nome e cognome.");
    }
    if (!birth) {
      throw new Error("Inserisci la data di nascita.");
    }
    if (emailTaken(normalized)) {
      if (pending.some((u) => u.email === normalized)) {
        throw new Error("C’è già una richiesta in attesa di approvazione per questa email.");
      }
      throw new Error("Esiste già un account con questa email.");
    }

    if (isAdminEmail(normalized)) {
      const user = {
        id: uid("staff"),
        role: ROLE_STAFF,
        nome: nome.trim(),
        cognome: cognome.trim(),
        dataNascita: birth,
        email: normalized,
        branca: null,
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
        verified: true,
        isAdmin: true,
      };
      users.push(user);
      saveUsers(users);
      clearDeletedNoticesForLogin({ email: normalized });
      setSession(user);
      await pushRemoteAccounts();
      return { user, pendingApproval: false };
    }

    if (!window.SCOUT_BRANCHES?.[branca]) {
      throw new Error("Seleziona una branca valida.");
    }

    const pendingUser = {
      id: uid("staff"),
      role: ROLE_STAFF,
      nome: nome.trim(),
      cognome: cognome.trim(),
      dataNascita: birth,
      email: normalized,
      branca,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
      verified: false,
      isAdmin: false,
    };
    pending.push(pendingUser);
    savePending(pending);
    clearDeletedNoticesForLogin({ email: normalized });
    await pushRemoteAccounts();
    return { user: pendingUser, pendingApproval: true };
  }

  async function registerRagazzo({
    nome,
    cognome,
    dataNascita,
    squadriglia,
    email,
    username,
    password,
  }) {
    const pending = getPending();
    const mail = String(email || "").trim().toLowerCase();
    const userName = normalizeUsername(username);
    const sq = String(squadriglia || "").trim();
    const birth = String(dataNascita || "").trim();

    if (password.length < 6) {
      throw new Error("La password deve avere almeno 6 caratteri.");
    }
    if (!nome?.trim() || !cognome?.trim()) {
      throw new Error("Inserisci nome e cognome.");
    }
    if (!birth) {
      throw new Error("Inserisci la data di nascita.");
    }
    if (!sq) {
      throw new Error("Inserisci la squadriglia.");
    }
    if (!mail && !userName) {
      throw new Error("Inserisci un’email oppure uno username.");
    }
    if (mail && isAdminEmail(mail)) {
      throw new Error("Questa email è riservata all’admin staff.");
    }
    if (mail && emailTaken(mail)) {
      if (pending.some((u) => u.email === mail)) {
        throw new Error("C’è già una richiesta in attesa di approvazione per questa email.");
      }
      throw new Error("Esiste già un account con questa email.");
    }
    if (!mail) {
      if (!/^[a-z0-9._-]{3,40}$/i.test(userName)) {
        throw new Error("Username non valido (usa lettere, numeri, . _ -).");
      }
      if (usernameTaken(userName)) {
        throw new Error("Questo username è già in uso.");
      }
    } else if (userName && usernameTaken(userName)) {
      throw new Error("Questo username è già in uso.");
    }

    const pendingUser = {
      id: uid("ragazzo"),
      role: ROLE_RAGAZZO,
      nome: nome.trim(),
      cognome: cognome.trim(),
      dataNascita: birth,
      squadriglia: sq,
      email: mail || null,
      username: userName || (mail ? null : suggestUsername(nome, cognome)),
      branca: "riparto",
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
      verified: false,
      isAdmin: false,
    };
    pending.push(pendingUser);
    savePending(pending);
    clearDeletedNoticesForLogin({ email: mail, username: pendingUser.username });
    await pushRemoteAccounts();
    return { user: pendingUser, pendingApproval: true };
  }

  function listPending(viewer) {
    if (!canOpenAccountRequests(viewer)) {
      throw new Error("Non puoi vedere le richieste account.");
    }
    return getPending().sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  }

  function listPendingStaff(viewer) {
    if (!canManageStaffRequests(viewer)) return [];
    return listPending(viewer).filter((p) => accountRole(p) === ROLE_STAFF);
  }

  function listPendingRagazzi(viewer) {
    if (!canManageRagazziRequests(viewer)) return [];
    return listPending(viewer).filter((p) => accountRole(p) === ROLE_RAGAZZO);
  }

  function listStaffAccounts(adminUser) {
    if (!isAdminUser(adminUser)) throw new Error("Solo l’admin può vedere gli account staff.");
    return getUsers()
      .filter((u) => u.verified && accountRole(u) === ROLE_STAFF)
      .map((u) => ({
        id: u.id,
        role: ROLE_STAFF,
        nome: u.nome,
        cognome: u.cognome,
        email: u.email,
        branca: isAdminEmail(u.email) ? null : u.branca || null,
        isAdmin: isAdminUser(u),
        createdAt: u.createdAt || null,
        approvedAt: u.approvedAt || null,
      }))
      .sort((a, b) => {
        if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
        const nameA = `${a.cognome || ""} ${a.nome || ""}`.toLowerCase();
        const nameB = `${b.cognome || ""} ${b.nome || ""}`.toLowerCase();
        return nameA.localeCompare(nameB, "it");
      });
  }

  function listRagazziAccounts(viewer) {
    if (!canManageRagazziRequests(viewer)) {
      throw new Error("Non puoi vedere gli account del Riparto.");
    }
    return getUsers()
      .filter((u) => u.verified && accountRole(u) === ROLE_RAGAZZO)
      .map((u) => ({
        id: u.id,
        role: ROLE_RAGAZZO,
        nome: u.nome,
        cognome: u.cognome,
        email: u.email,
        username: u.username || "",
        squadriglia: u.squadriglia || "",
        dataNascita: u.dataNascita || "",
        createdAt: u.createdAt || null,
        approvedAt: u.approvedAt || null,
        ...normalizeProgress(u),
      }))
      .sort((a, b) => {
        const sq = (a.squadriglia || "").localeCompare(b.squadriglia || "", "it");
        if (sq) return sq;
        const nameA = `${a.cognome || ""} ${a.nome || ""}`.toLowerCase();
        const nameB = `${b.cognome || ""} ${b.nome || ""}`.toLowerCase();
        return nameA.localeCompare(nameB, "it");
      });
  }

  async function deleteStaffAccount(userId, adminUser, { message } = {}) {
    if (!isAdminUser(adminUser)) throw new Error("Solo l’admin può eliminare account staff.");
    const users = getUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) throw new Error("Account non trovato.");
    if (accountRole(target) !== ROLE_STAFF) {
      throw new Error("Usa la sezione Ripartari per eliminare questo account.");
    }
    if (isAdminEmail(target.email)) {
      throw new Error("Non puoi eliminare l’account admin principale.");
    }
    if (target.id === adminUser.id) {
      throw new Error("Non puoi eliminare il tuo stesso account mentre sei connesso.");
    }
    addDeletedNotice(target, { message, deletedBy: adminUser.id });
    saveUsers(users.filter((u) => u.id !== userId));
    await pushRemoteAccounts();
    return true;
  }

  async function deleteRagazzoAccount(userId, viewer, { message } = {}) {
    if (!canManageRagazziRequests(viewer)) {
      throw new Error("Non puoi eliminare account del Riparto.");
    }
    const users = getUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) throw new Error("Account non trovato.");
    if (accountRole(target) !== ROLE_RAGAZZO) {
      throw new Error("Questo non è un account esploratore/guida.");
    }
    addDeletedNotice(target, { message, deletedBy: viewer.id });
    saveUsers(users.filter((u) => u.id !== userId));
    await pushRemoteAccounts();
    return true;
  }

  async function approvePending(pendingId, viewer) {
    const pending = getPending();
    const idx = pending.findIndex((u) => u.id === pendingId);
    if (idx < 0) throw new Error("Richiesta non trovata.");
    const item = pending[idx];
    const role = accountRole(item);

    if (role === ROLE_RAGAZZO) {
      if (!canManageRagazziRequests(viewer)) {
        throw new Error("Non puoi approvare richieste dei Ripartari.");
      }
    } else if (!canManageStaffRequests(viewer)) {
      throw new Error("Solo l’admin può approvare richieste staff.");
    }

    const users = getUsers();
    if (item.email && users.some((u) => u.email === item.email)) {
      pending.splice(idx, 1);
      savePending(pending);
      await pushRemoteAccounts();
      throw new Error("Questa email è già registrata.");
    }
    if (item.username && users.some((u) => u.username === item.username)) {
      pending.splice(idx, 1);
      savePending(pending);
      await pushRemoteAccounts();
      throw new Error("Questo username è già registrato.");
    }
    const user = {
      id: item.id,
      role,
      nome: item.nome,
      cognome: item.cognome,
      email: item.email || null,
      username: item.username || null,
      branca: role === ROLE_RAGAZZO ? "riparto" : item.branca,
      squadriglia: item.squadriglia || null,
      dataNascita: item.dataNascita || null,
      passwordHash: item.passwordHash,
      createdAt: item.createdAt,
      verified: true,
      isAdmin: false,
      approvedAt: new Date().toISOString(),
      approvedBy: viewer.id,
    };
    users.push(user);
    saveUsers(users);
    pending.splice(idx, 1);
    savePending(pending);
    await pushRemoteAccounts();

    let emailNotify = { sent: false, skipped: true };
    if (user.email && typeof CloudSync !== "undefined" && CloudSync.notifyAccountApproved) {
      try {
        emailNotify = await CloudSync.notifyAccountApproved({
          email: user.email,
          nome: user.nome,
          cognome: user.cognome,
          role,
        });
      } catch (err) {
        emailNotify = { sent: false, error: err.message || "Email non inviata" };
      }
    } else if (!user.email) {
      emailNotify = { sent: false, skipped: true, reason: "nessuna email" };
    }
    return { user, emailNotify };
  }

  async function rejectPending(pendingId, viewer) {
    const pending = getPending();
    const item = pending.find((u) => u.id === pendingId);
    if (!item) throw new Error("Richiesta non trovata.");
    const role = accountRole(item);
    if (role === ROLE_RAGAZZO) {
      if (!canManageRagazziRequests(viewer)) {
        throw new Error("Non puoi rifiutare richieste dei Ripartari.");
      }
    } else if (!canManageStaffRequests(viewer)) {
      throw new Error("Solo l’admin può rifiutare richieste staff.");
    }
    savePending(pending.filter((u) => u.id !== pendingId));
    await pushRemoteAccounts();
  }

  async function loginStaff({ email, password, login: loginId }) {
    await pullRemoteAccounts();
    const users = getUsers();
    const key = String(loginId || email || "").trim().toLowerCase();
    if (!key) throw new Error("Inserisci email o username.");
    if (findPendingByLogin(key)) {
      throw new Error("Account in attesa di approvazione.");
    }
    const user = findUserByLogin(key);
    if (!user) {
      const deleted = findDeletedNoticeByLogin(key);
      if (deleted) throw new Error(deletedAccountLoginMessage(deleted));
      throw new Error("Credenziali non corrette.");
    }
    if (!user.verified) throw new Error("Account non ancora approvato.");
    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) throw new Error("Credenziali non corrette.");

    if (isStaffUser(user) && isAdminEmail(user.email)) {
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

  const login = loginStaff;

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
        imageId: e.imageId || null,
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
    pushRemoteEvents().catch(() => {});
  }

  async function pushRemoteEvents() {
    if (typeof CloudSync === "undefined") return;
    await CloudSync.putEvents(getEvents());
  }

  async function pullRemoteEvents() {
    if (typeof CloudSync === "undefined") return false;
    const remote = await CloudSync.getEvents();
    if (!remote) return false;
    const remoteItems = Array.isArray(remote.items) ? remote.items : [];
    if (remoteItems.length) {
      write(KEYS.events, remoteItems);
      return true;
    }
    const local = read(KEYS.events, []);
    if (Array.isArray(local) && local.length) {
      await CloudSync.putEvents(getEvents());
    }
    return false;
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
      imageId: event.imageId || null,
    };
  }

  async function addEvent(event, user) {
    if (!user) throw new Error("Devi essere autenticato.");
    const data = normalizeEventInput(event, user);
    if (!data.title || !data.dateStart) throw new Error("Titolo e data inizio sono obbligatori.");

    let imageId = null;
    if (event.imageFile instanceof File && event.imageFile.size) {
      if (typeof GalleryStore === "undefined") throw new Error("Upload immagine non disponibile.");
      imageId = await GalleryStore.uploadAttachment(event.imageFile, user);
    }

    const item = {
      id: uid("evt"),
      ...data,
      imageId,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!canManageEvent(user, item)) {
      if (imageId) GalleryStore.deleteAttachment(imageId, user).catch(() => {});
      throw new Error("Non puoi creare questo tipo di evento.");
    }
    const events = getEvents();
    events.push(item);
    saveEvents(events);
    return item;
  }

  async function updateEvent(id, patch, user) {
    if (!user) throw new Error("Devi essere autenticato.");
    const events = getEvents();
    const idx = events.findIndex((e) => e.id === id);
    if (idx < 0) throw new Error("Evento non trovato.");
    const current = events[idx];
    if (!canManageEvent(user, current)) throw new Error("Non puoi modificare questo evento.");
    const merged = normalizeEventInput({ ...current, ...patch }, user);
    if (!canManageEvent(user, merged)) throw new Error("Non puoi impostare questo tipo di evento.");
    if (!merged.title || !merged.dateStart) throw new Error("Titolo e data inizio sono obbligatori.");

    let imageId = current.imageId || null;
    const prevImageId = imageId;
    if (patch.clearImage) {
      imageId = null;
    } else if (patch.imageFile instanceof File && patch.imageFile.size) {
      if (typeof GalleryStore === "undefined") throw new Error("Upload immagine non disponibile.");
      imageId = await GalleryStore.uploadAttachment(patch.imageFile, user);
    }

    events[idx] = {
      ...current,
      ...merged,
      imageId,
      updatedAt: new Date().toISOString(),
    };
    saveEvents(events);
    if (prevImageId && prevImageId !== imageId && typeof GalleryStore !== "undefined") {
      GalleryStore.deleteAttachment(prevImageId, user).catch(() => {});
    }
    return events[idx];
  }

  async function deleteEvent(id, user) {
    if (!user) throw new Error("Devi essere autenticato.");
    const events = getEvents();
    const item = events.find((e) => e.id === id);
    if (!item) return;
    if (!canManageEvent(user, item)) throw new Error("Non puoi eliminare questo evento.");
    saveEvents(events.filter((e) => e.id !== id));
    if (item.imageId && typeof GalleryStore !== "undefined") {
      GalleryStore.deleteAttachment(item.imageId, user).catch(() => {});
    }
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
      branchNotes:
        raw.branchNotes && typeof raw.branchNotes === "object" ? raw.branchNotes : {},
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
      branchNotes: s.branchNotes || {},
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
      (Array.isArray(remote.googleCalendars) && remote.googleCalendars.length) ||
      (remote.branchNotes && Object.keys(remote.branchNotes).length);
    if (!has) {
      const local = getSettings();
      if (
        getIscrizioniFormUrl() ||
        local.social ||
        (local.meetingHours || []).length ||
        (local.googleCalendars || []).length ||
        Object.keys(local.branchNotes || {}).length
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
    if (remote.branchNotes && typeof remote.branchNotes === "object" && Object.keys(remote.branchNotes).length) {
      next.branchNotes = remote.branchNotes;
    } else if (Object.keys(next.branchNotes || {}).length) {
      pushRemoteSettings().catch(() => {});
    }
    write(KEYS.settings, next);
    return true;
  }

  function branchNotesKey(branca) {
    return normalizeBrancaId(branca) || String(branca || "").trim() || "gruppo";
  }

  function getBranchNotes(branca) {
    const key = branchNotesKey(branca);
    const all = getSettings().branchNotes || {};
    const row = all[key] || {};
    return {
      branca: key,
      text: String(row.text || ""),
      sheetUrl: String(row.sheetUrl || "").trim(),
      updatedAt: row.updatedAt || null,
      updatedBy: row.updatedBy || null,
    };
  }

  function listBranchNotesForUser(user) {
    if (!user || !isStaffUser(user)) return [];
    const branches = Object.keys(window.SCOUT_BRANCHES || {});
    if (isAdminUser(user)) {
      return branches.map((b) => getBranchNotes(b));
    }
    if (!user.branca) return [];
    return [getBranchNotes(user.branca)];
  }

  function canEditBranchNotes(user, branca) {
    if (!user || !isStaffUser(user)) return false;
    if (isAdminUser(user)) return true;
    return !!user.branca && branchNotesKey(user.branca) === branchNotesKey(branca);
  }

  function saveBranchNotes(branca, { text, sheetUrl }, user) {
    if (!canEditBranchNotes(user, branca)) {
      throw new Error("Non puoi modificare le note di questa branca.");
    }
    const key = branchNotesKey(branca);
    const cleanUrl = String(sheetUrl || "").trim();
    if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) {
      throw new Error("Incolla un URL completo (https://…) per il foglio.");
    }
    const settings = getSettings();
    const branchNotes = { ...(settings.branchNotes || {}) };
    branchNotes[key] = {
      text: String(text || "").slice(0, 20000),
      sheetUrl: cleanUrl,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    };
    write(KEYS.settings, { ...settings, branchNotes });
    pushRemoteSettings().catch(() => {});
    return getBranchNotes(key);
  }

  function listGoogleCalendars() {
    return (getSettings().googleCalendars || []).map((c) => ({
      ...c,
      branca: c.branca ? normalizeBrancaId(c.branca) : c.branca,
    }));
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
    const key = branca === "gruppo" ? "gruppo" : normalizeBrancaId(branca);
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
          const id = normalizeMeetingSlotId(h.id === "lupetti" ? "lupetti-girone" : h.id);
          const label =
            id === "branco-girone" && (!h.label || /lupetti/i.test(h.label))
              ? "Branco — Girone"
              : id === "branco-quarate" && (!h.label || /lupetti/i.test(h.label))
                ? "Branco — Quarate"
                : h.label || id;
          return {
            id,
            label,
            branca: normalizeBrancaId(h.branca) || "",
            day: h.day || "",
            time: h.time || "",
            place: h.place || "",
          };
        }
        if (h.branca === "lupetti" || h.branca === "branco" || h.id === "lupetti") {
          return {
            id: "branco-girone",
            label: "Branco — Girone",
            branca: "branco",
            day: h.day || "",
            time: h.time || "",
            place: h.place || "Girone",
          };
        }
        if (h.branca === "riparto") {
          return {
            id: "riparto-girone",
            label: "Riparto — Girone",
            branca: "riparto",
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
        branco: pickIg("branco", "Branco"),
        riparto: pickIg("riparto", "Riparto"),
        noviziato: pickIg("noviziato", "Noviziato"),
        clan: pickIg("clan", "Clan"),
      },
      homeInstagram: String(cfg.homeInstagram || "riparto"),
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

    const mergeIg = (id, legacyId) => {
      const fromSaved = saved.instagram?.[id] ?? (legacyId ? saved.instagram?.[legacyId] : null);
      const fromBase = base.instagram[id];
      const entry = normalizeSocialEntry(fromSaved ?? fromBase, fromBase.url, fromBase.label);
      if (!entry.url && fromBase.url) entry.url = fromBase.url;
      if (!entry.label || entry.label === "Lupetti") entry.label = fromBase.label;
      return entry;
    };

    let homeInstagram = String(saved.homeInstagram || base.homeInstagram || "riparto");
    if (homeInstagram === "lupetti") homeInstagram = "branco";
    if (homeInstagram === "reparto" || homeInstagram === "Reparto") homeInstagram = "riparto";
    return {
      facebook: fb,
      instagram: {
        gruppo: mergeIg("gruppo"),
        branco: mergeIg("branco", "lupetti"),
        riparto: mergeIg("riparto", "reparto"),
        noviziato: mergeIg("noviziato"),
        clan: mergeIg("clan"),
      },
      homeInstagram,
    };
  }

  function saveSocialLinks(social, user) {
    if (!isAdminUser(user)) throw new Error("Solo admin può aggiornare i social.");
    let homeInstagram = String(social?.homeInstagram || "riparto");
    if (homeInstagram === "lupetti") homeInstagram = "branco";
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
        branco: {
          url: String(
            social?.instagram?.branco?.url ??
              social?.instagram?.branco ??
              social?.instagram?.lupetti?.url ??
              social?.instagram?.lupetti ??
              ""
          ).trim(),
          label: String(social?.instagram?.branco?.label || "Branco").trim() || "Branco",
        },
        riparto: {
          url: String(social?.instagram?.riparto?.url ?? social?.instagram?.riparto ?? "").trim(),
          label: String(social?.instagram?.riparto?.label || "riparto").trim() || "riparto",
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
      homeInstagram,
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
    ROLE_STAFF,
    ROLE_RAGAZZO,
    isAdminEmail,
    isAdminUser,
    isStaffUser,
    isRagazzoUser,
    accountRole,
    canManageStaffRequests,
    canManageRagazziRequests,
    canOpenAccountRequests,
    canManageSentieri,
    CLASSI_SENTIERO,
    classiOttenuteDisplay,
    getRagazzoProgress,
    updateRagazzoProgress,
    normalizeBrancaId,
    branchLabel,
    scopeLabel,
    registerStaff,
    registerRagazzo,
    suggestUsername,
    canOpenSpecialitaPdf,
    listPending,
    listPendingStaff,
    listPendingRagazzi,
    listStaffAccounts,
    listRagazziAccounts,
    deleteStaffAccount,
    deleteRagazzoAccount,
    approvePending,
    rejectPending,
    loginStaff,
    login,
    logout,
    pullRemoteAccounts,
    pushRemoteAccounts,
    pullRemoteEvents,
    pushRemoteEvents,
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
    getBranchNotes,
    listBranchNotesForUser,
    canEditBranchNotes,
    saveBranchNotes,
  };
})();
