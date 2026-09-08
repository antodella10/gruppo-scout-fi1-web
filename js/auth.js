document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const alertBox = document.getElementById("auth-alert");
  const brancaField = document.getElementById("branca-field");
  const brancaSelect = registerForm?.querySelector('[name="branca"]');
  const emailInput = registerForm?.querySelector('[name="email"]');

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
    const admin = ScoutStore.isAdminEmail(emailInput.value);
    brancaField.hidden = admin;
    brancaSelect.required = !admin;
    if (admin) brancaSelect.value = "";
  }

  emailInput?.addEventListener("input", syncAdminFields);
  syncAdminFields();

  // Allinea account da cloud prima del login (necessario su telefono/altro browser).
  ScoutStore.pullRemoteAccounts?.().catch(() => {});

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(loginForm);
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      await ScoutStore.loginStaff({
        email: data.get("email"),
        password: data.get("password"),
      });
      const logged = ScoutStore.getCurrentUser();
      if (logged && !ScoutStore.isAdminUser(logged) && logged.branca && typeof BranchView !== "undefined") {
        BranchView.persist(logged.branca, { updateUrl: false });
      }
      location.href = "./index.html";
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
        email: data.get("email"),
        password: data.get("password"),
        branca: data.get("branca"),
      });

      if (result.pendingApproval) {
        showOk(
          "Richiesta inviata. L’admin dovrà approvarla dall’area staff. Poi potrai accedere."
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
});
