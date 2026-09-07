document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const verifyForm = document.getElementById("verify-form");
  const alertBox = document.getElementById("auth-alert");

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
      const result = await ScoutStore.registerStaff({
        nome: data.get("nome"),
        cognome: data.get("cognome"),
        email: data.get("email"),
        password: data.get("password"),
        branca: data.get("branca"),
      });

      if (result.needsOtp) {
        const mailto = ScoutStore.buildOtpMailto(result.user);
        sessionStorage.setItem("pendingStaffEmail", result.user.email);
        const mailLink = document.createElement("a");
        mailLink.href = mailto;
        mailLink.rel = "noopener";
        document.body.appendChild(mailLink);
        mailLink.click();
        mailLink.remove();
        location.href = `./verify.html?email=${encodeURIComponent(result.user.email)}`;
        return;
      }

      location.href = "./index.html";
    } catch (err) {
      showError(err.message || "Registrazione non riuscita.");
    }
  });

  if (verifyForm) {
    const params = new URLSearchParams(location.search);
    const preset =
      params.get("email") || sessionStorage.getItem("pendingStaffEmail") || "";
    if (preset && verifyForm.email) verifyForm.email.value = preset;

    verifyForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(verifyForm);
      try {
        await ScoutStore.verifyOtp({
          email: data.get("email"),
          otp: data.get("otp"),
        });
        sessionStorage.removeItem("pendingStaffEmail");
        showOk("Account verificato! Reindirizzamento…");
        window.setTimeout(() => {
          location.href = "./index.html";
        }, 700);
      } catch (err) {
        showError(err.message || "Verifica non riuscita.");
      }
    });
  }
});
