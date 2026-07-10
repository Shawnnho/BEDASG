/*************************************************
 * signin.js
 * - Guest: skips login, goes straight to index.html?mode=guest
 * - Customer / Store Holder buttons are just a visual preference —
 *   the actual role always comes from the server's response after login,
 *   never from which button was clicked.
 *************************************************/

const form = document.getElementById("loginForm");
const statusMsg = document.getElementById("statusMsg");

const email = document.getElementById("email");
const password = document.getElementById("password");
const emailError = document.getElementById("emailError");
const pwError = document.getElementById("pwError");

const togglePasswordBtn = document.getElementById("togglePassword");
const eyeIcon = document.getElementById("eyeIcon");

const roleButtons = Array.from(document.querySelectorAll(".role"));

/* =========================
   Role buttons (guest = skip login entirely)
========================= */
roleButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const role = btn.dataset.role;

    if (role === "guest") {
      window.location.href = "index.html?mode=guest";
      return;
    }

    roleButtons.forEach((b) => b.setAttribute("aria-pressed", "false"));
    btn.setAttribute("aria-pressed", "true");
  });
});

/* =========================
   Password show/hide
========================= */
togglePasswordBtn?.addEventListener("click", () => {
  const isHidden = password.type === "password";
  password.type = isHidden ? "text" : "password";
  eyeIcon.src = isHidden ? "images/show.png" : "images/hide.png";
  eyeIcon.alt = isHidden ? "Show password" : "Hide password";
  togglePasswordBtn.setAttribute(
    "aria-label",
    isHidden ? "Show password" : "Hide password",
  );
});

/* =========================
   Validation
========================= */
function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function clearErrors() {
  emailError.textContent = "";
  pwError.textContent = "";
  statusMsg.textContent = "";
}

function validate() {
  clearErrors();
  let ok = true;

  if (!email.value.trim()) {
    emailError.textContent = "Please enter your email.";
    ok = false;
  } else if (!isEmail(email.value)) {
    emailError.textContent = "Please enter a valid email.";
    ok = false;
  }

  if (!password.value) {
    pwError.textContent = "Please enter your password.";
    ok = false;
  }

  return ok;
}

/* =========================
   Submit
========================= */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validate()) return;

  statusMsg.textContent = "Signing in...";

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.value.trim(),
        password: password.value,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      pwError.textContent = data.error || "Invalid email or password.";
      return;
    }

    statusMsg.textContent = `✅ Signed in as ${data.user.name || data.user.email}. Redirecting...`;

    setTimeout(() => {
      // Redirect based on the REAL role the server returned, not the
      // role button the user happened to click before submitting.
      const roleLocation = { "storeholder" : "stall-dashboard.html", "customer": "home.html", "operator" : "operator.html", "nea_officer" : "nea.html" };
      window.location.href =
        roleLocation[data.user.role] || "index.html";
    }, 700);
  } catch (err) {
    console.error(err);
    statusMsg.textContent = "❌ Network error. Please try again.";
  }
});
