document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const alertBox = document.getElementById("auth-alert");

  function showError(msg) {
    if (!alertBox) return;
    alertBox.hidden = false;
    alertBox.className = "alert alert-error";
    alertBox.textContent = msg;
  }

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(loginForm);
    try {
      await ScoutStore.loginStaff({
        email: data.get("email"),
        password: data.get("password"),
      });
      location.href = "./index.html";
    } catch (err) {
      showError(err.message || "Accesso non riuscito.");
    }
  });

  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(registerForm);
    try {
      await ScoutStore.registerStaff({
        nome: data.get("nome"),
        cognome: data.get("cognome"),
        email: data.get("email"),
        password: data.get("password"),
      });
      location.href = "./index.html";
    } catch (err) {
      showError(err.message || "Registrazione non riuscita.");
    }
  });
});
