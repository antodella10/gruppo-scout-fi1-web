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
  const squadrigliaField = document.getElementById("squadriglia-field");
  const squadrigliaInput = registerUnifiedForm?.querySelector('[name="squadriglia"]');
  const roleInput = document.getElementById("register-role");

  function showError(msg) {
    if (!alertBox) return;
    alertBox.hidden = false;
    alertBox.className = "alert alert-error";
    alertBox.textContent = msg;
  }

  function showOk(msg) {
    if (!alertBox) return;
    alertBox.hidden = false;
    alertBox.className = "alert alert-ok";
    alertBox.textContent = msg;
  }

  function syncAdminFields() {
    if (!emailInput || !brancaField || !brancaSelect) return;
    const role = roleInput?.value || "staff";
    if (role !== "staff") return;
    const admin = ScoutStore.isAdminEmail(emailInput.value);
    brancaField.hidden = admin;
    brancaSelect.required = !admin;
    if (admin) brancaSelect.value = "";
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
    if (squadrigliaField) squadrigliaField.hidden = isStaff;
    if (squadrigliaInput) {
      squadrigliaInput.required = !isStaff;
      if (isStaff) squadrigliaInput.value = "";
    }
    if (brancaField) {
      const admin = emailInput && ScoutStore.isAdminEmail(emailInput.value);
      brancaField.hidden = !isStaff || !!admin;
      if (brancaSelect) {
        brancaSelect.required = isStaff && !admin;
        if (!isStaff) brancaSelect.value = "";
      }
    }
    syncAdminFields();
  }

  document.querySelectorAll(".role-pick").forEach((btn) => {
    btn.addEventListener("click", () => setRegisterRole(btn.dataset.role));
  });
  if (registerUnifiedForm) setRegisterRole(roleInput?.value || "ragazzo");

  emailInput?.addEventListener("input", syncAdminFields);
  syncAdminFields();

  ScoutStore.pullRemoteAccounts?.().catch(() => {});

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(loginForm);
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const user = await ScoutStore.loginStaff({
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
        showOk(
          "Richiesta inviata. L’admin dovrà approvarla dall’area richieste account. Poi potrai accedere."
        );
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
        password: data.get("password"),
      });
      showOk(
        "Richiesta inviata. Quando lo staff la approva potrai accedere e aprire i file del Sentiero."
      );
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
          showOk(
            "Richiesta staff inviata. Dopo l’approvazione riceverai una email e potrai accedere all’area staff."
          );
          registerUnifiedForm.reset();
          setRegisterRole("staff");
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
        password: data.get("password"),
      });
      showOk(
        "Richiesta inviata. Dopo l’approvazione riceverai una email e potrai aprire i file del Sentiero."
      );
      registerUnifiedForm.reset();
      setRegisterRole("ragazzo");
    } catch (err) {
      showError(err.message || "Registrazione non riuscita.");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});
