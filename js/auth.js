document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const registerRagazzoForm = document.getElementById("register-ragazzo-form");
  const registerUnifiedForm = document.getElementById("register-unified-form");
  const alertBox = document.getElementById("auth-alert");
  const brancaField = document.getElementById("branca-field");
  const brancaSelect =
    registerUnifiedForm?.querySelector('[name="branca"]') ||
    registerForm?.querySelector('[name="branca"]');
  const emailInput =
    registerUnifiedForm?.querySelector('[name="email"]') ||
    registerForm?.querySelector('[name="email"]');
  const usernameField = document.getElementById("username-field");
  const usernameInput = registerUnifiedForm?.querySelector('[name="username"]');
  const emailOptionalHint = document.getElementById("email-optional-hint");
  const nomeInput = registerUnifiedForm?.querySelector('[name="nome"]');
  const cognomeInput = registerUnifiedForm?.querySelector('[name="cognome"]');
  const squadrigliaField = document.getElementById("squadriglia-field");
  const squadrigliaInput = registerUnifiedForm?.querySelector('[name="squadriglia"]');
  const roleInput = document.getElementById("register-role");

  let lastSuggestedUsername = "";

  function showError(msg) {
    if (!alertBox) return;
    alertBox.hidden = false;
    alertBox.className = "alert alert-error";
    alertBox.style.whiteSpace = "pre-line";
    alertBox.textContent = msg;
  }

  function showOk(msg) {
    if (!alertBox) return;
    alertBox.hidden = false;
    alertBox.className = "alert alert-ok";
    alertBox.style.whiteSpace = "pre-line";
    alertBox.textContent = msg;
  }

  function showRegisterDone(msg) {
    showOk(msg || "Richiesta inviata. Riceverai una conferma quando l’account sarà attivo.");
    document.querySelectorAll("[data-register-fields], [data-register-intro]").forEach((el) => {
      el.hidden = true;
      el.classList.add("is-hidden");
    });
    const title = document.querySelector(".auth-card h1");
    if (title) title.textContent = "Richiesta inviata";
    const done = document.getElementById("register-done-actions");
    if (done) {
      done.hidden = false;
      done.classList.remove("is-hidden");
    }
  }

  function syncAdminFields() {
    if (!emailInput || !brancaField || !brancaSelect) return;
    const role = roleInput?.value || "staff";
    if (role !== "staff") {
      brancaField.hidden = true;
      brancaField.classList.add("is-hidden");
      brancaSelect.required = false;
      return;
    }
    const admin = ScoutStore.isAdminEmail(emailInput.value);
    brancaField.hidden = admin;
    brancaField.classList.toggle("is-hidden", admin);
    brancaSelect.required = !admin;
    if (admin) brancaSelect.value = "";
  }

  function applyUsernameSuggestion({ force = false } = {}) {
    if (!usernameInput || !ScoutStore.suggestUsername) return;
    const suggested = ScoutStore.suggestUsername(nomeInput?.value, cognomeInput?.value);
    const current = String(usernameInput.value || "").trim().toLowerCase();
    if (force || !current || current === lastSuggestedUsername) {
      usernameInput.value = suggested;
      lastSuggestedUsername = suggested;
    }
  }

  function syncUsernameFields() {
    if (!usernameField || !usernameInput || !emailInput) return;
    const role = roleInput?.value || "ragazzo";
    const isRagazzo = role === "ragazzo";
    usernameField.hidden = !isRagazzo;
    usernameField.classList.toggle("is-hidden", !isRagazzo);
    if (emailOptionalHint) {
      emailOptionalHint.hidden = !isRagazzo;
    }
    if (!isRagazzo) {
      emailInput.required = true;
      usernameInput.required = false;
      usernameInput.value = "";
      lastSuggestedUsername = "";
      return;
    }
    const hasEmail = String(emailInput.value || "").trim().length > 0;
    emailInput.required = false;
    usernameInput.required = !hasEmail;
    if (!hasEmail) applyUsernameSuggestion();
  }

  function setRegisterRole(role) {
    if (!roleInput) return;
    roleInput.value = role;
    document.querySelectorAll(".role-pick").forEach((btn) => {
      const on = btn.dataset.role === role;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const isStaff = role === "staff";
    if (squadrigliaField) {
      squadrigliaField.hidden = isStaff;
      squadrigliaField.classList.toggle("is-hidden", isStaff);
    }
    if (squadrigliaInput) {
      squadrigliaInput.required = !isStaff;
      if (isStaff) squadrigliaInput.value = "";
    }
    if (brancaField) {
      const admin = emailInput && ScoutStore.isAdminEmail(emailInput.value);
      const hideBranca = !isStaff || !!admin;
      brancaField.hidden = hideBranca;
      brancaField.classList.toggle("is-hidden", hideBranca);
      if (brancaSelect) {
        brancaSelect.required = isStaff && !admin;
        if (!isStaff) brancaSelect.value = "";
      }
    }
    syncUsernameFields();
    syncAdminFields();
  }

  document.querySelectorAll(".role-pick").forEach((btn) => {
    btn.addEventListener("click", () => setRegisterRole(btn.dataset.role));
  });
  if (registerUnifiedForm) setRegisterRole(roleInput?.value || "ragazzo");

  emailInput?.addEventListener("input", () => {
    syncAdminFields();
    syncUsernameFields();
  });
  nomeInput?.addEventListener("input", () => applyUsernameSuggestion());
  cognomeInput?.addEventListener("input", () => applyUsernameSuggestion());
  syncAdminFields();
  syncUsernameFields();

  ScoutStore.pullRemoteAccounts?.().catch(() => {});

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(loginForm);
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const user = await ScoutStore.loginStaff({
        login: data.get("login") || data.get("email"),
        email: data.get("email"),
        password: data.get("password"),
      });
      const auto = loginForm.dataset.authRedirect === "auto";
      if (ScoutStore.isRagazzoUser(user)) {
        location.href = auto ? "./index.html" : "../area-personale/";
        return;
      }
      if (!ScoutStore.isAdminUser(user) && user.branca && typeof BranchView !== "undefined") {
        BranchView.persist(user.branca, { updateUrl: false });
      }
      location.href = auto ? "../staff/" : "./index.html";
    } catch (err) {
      showError(err.message || "Accesso non riuscito.");
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(registerForm);
    try {
      await ScoutStore.pullRemoteAccounts?.();
      const result = await ScoutStore.registerStaff({
        nome: data.get("nome"),
        cognome: data.get("cognome"),
        dataNascita: data.get("dataNascita"),
        email: data.get("email"),
        password: data.get("password"),
        branca: data.get("branca"),
      });

      if (result.pendingApproval) {
        showOk("Richiesta inviata. Riceverai una conferma quando l’account sarà attivo.");
        registerForm.reset();
        syncAdminFields();
        return;
      }

      location.href = "./index.html";
    } catch (err) {
      showError(err.message || "Registrazione non riuscita.");
    }
  });

  registerRagazzoForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(registerRagazzoForm);
    const submitBtn = registerRagazzoForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      await ScoutStore.pullRemoteAccounts?.();
      await ScoutStore.registerRagazzo({
        nome: data.get("nome"),
        cognome: data.get("cognome"),
        dataNascita: data.get("dataNascita"),
        squadriglia: data.get("squadriglia"),
        email: data.get("email"),
        username: data.get("username"),
        password: data.get("password"),
      });
      showOk("Richiesta inviata. Riceverai una conferma quando l’account sarà attivo.");
      registerRagazzoForm.reset();
    } catch (err) {
      showError(err.message || "Registrazione non riuscita.");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  registerUnifiedForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(registerUnifiedForm);
    const role = String(data.get("role") || "ragazzo");
    const submitBtn = registerUnifiedForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      await ScoutStore.pullRemoteAccounts?.();
      if (role === "staff") {
        const result = await ScoutStore.registerStaff({
          nome: data.get("nome"),
          cognome: data.get("cognome"),
          dataNascita: data.get("dataNascita"),
          email: data.get("email"),
          password: data.get("password"),
          branca: data.get("branca"),
        });
        if (result.pendingApproval) {
          showRegisterDone();
          return;
        }
        location.href = "../staff/";
        return;
      }

      await ScoutStore.registerRagazzo({
        nome: data.get("nome"),
        cognome: data.get("cognome"),
        dataNascita: data.get("dataNascita"),
        squadriglia: data.get("squadriglia"),
        email: data.get("email"),
        username: data.get("username"),
        password: data.get("password"),
      });
      showRegisterDone();
    } catch (err) {
      showError(err.message || "Registrazione non riuscita.");
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});
