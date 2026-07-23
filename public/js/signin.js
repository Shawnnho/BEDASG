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
   Deactivated account popup
========================= */
const SUPPORT_EMAIL = "support@hawkerpoint.sg";
const SUPPORT_PHONE = "+65 6677 9988";

function showDeactivatedModal(role) {
  // Wording matches the SQL Users.IsDeactivated flag set on either the
  // stallholder deactivate flow or a customer's own account.
  const noun = role === "storeholder" ? "stall account" : "account";

  const overlay = document.createElement("div");
  overlay.className = "hpModalOverlay";
  overlay.innerHTML = `
    <div class="hpModal" role="dialog" aria-modal="true" aria-label="Account Deactivated">
      <div class="hpModalHead">
        <div class="hpModalTitle">Account Deactivated</div>
        <button class="hpModalClose" type="button" aria-label="Close">✕</button>
      </div>
      <div class="hpModalBody">
        <p style="margin:0 0 10px; line-height:1.5;">
          This ${noun} is no longer active on HawkerPoint.
        </p>
        <p style="margin:0; line-height:1.5;">
          Should you wish to resume operations or believe this to be an error,
          our support team can assist — please reach us at
          <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> or
          <a href="tel:${SUPPORT_PHONE.replace(/\s+/g, "")}">${SUPPORT_PHONE}</a>,
          quoting your registered email address.
        </p>
      </div>
      <div class="hpModalFoot">
        <button class="hpModalBtn ghost" type="button" data-action="close">Close</button>
        <button class="hpModalBtn primary" type="button" data-action="email">Email Support</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector(".hpModalClose").addEventListener("click", close);
  overlay.querySelector('[data-action="close"]').addEventListener("click", close);
  overlay.querySelector('[data-action="email"]').addEventListener("click", () => {
    window.location.href = `mailto:${SUPPORT_EMAIL}`;
  });

  document.addEventListener(
    "keydown",
    function escHandler(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", escHandler);
      }
    },
    { once: true },
  );
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
      if (data.deactivated) {
        statusMsg.textContent = "";
        showDeactivatedModal(data.role);
        return;
      }
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