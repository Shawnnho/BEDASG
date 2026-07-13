/*************************************************
 * signup.js
 * - Roles: customer | storeholder
 * - Storeholder shows extra stall fields, loaded/created via the API
 *   (no more Firebase/Firestore — this now talks to /api/auth and /api/centres)
 *************************************************/

// DOM
const form = document.getElementById("signupForm");
const statusMsg = document.getElementById("statusMsg");

const fullName = document.getElementById("fullName");
const email = document.getElementById("email");
const phone = document.getElementById("phone");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const confirmPwError = document.getElementById("confirmPwError");
const nameError = document.getElementById("nameError");
const emailError = document.getElementById("emailError");
const phoneError = document.getElementById("phoneError");
const pwError = document.getElementById("pwError");

// Password toggle
const togglePasswordBtn = document.getElementById("togglePassword");
const eyeIcon = document.getElementById("eyeIcon");

// Role selection
const roleButtons = Array.from(document.querySelectorAll(".role"));
let selectedRole = "customer";

// Storeholder fields
const stallFields = document.getElementById("stallFields");
const stallCentreId = document.getElementById("stallCentreId");
const stallName = document.getElementById("stallName");
const stallCuisine = document.getElementById("stallCuisine");
const unitPreview = document.getElementById("unitPreview");

const stallCentreError = document.getElementById("stallCentreError");
const stallNameError = document.getElementById("stallNameError");
const stallCuisineError = document.getElementById("stallCuisineError");

/* =========================
   Load hawker centres for the dropdown
========================= */
async function loadHawkerCentres() {
  if (!stallCentreId) return;

  try {
    const res = await fetch("/api/centres");
    const centres = await res.json();

    stallCentreId.innerHTML = `<option value="">Select Hawker Centre</option>`;
    centres.forEach((c) => {
      const option = document.createElement("option");
      option.value = c.centreId;
      option.textContent = c.name;
      stallCentreId.appendChild(option);
    });
  } catch (err) {
    console.error("Failed to load centres:", err);
  }
}

/* =========================
   Role buttons
========================= */
roleButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    roleButtons.forEach((b) => b.setAttribute("aria-pressed", "false"));
    btn.setAttribute("aria-pressed", "true");
    selectedRole = btn.dataset.role; // customer | storeholder

    if (stallFields) {
      stallFields.hidden = selectedRole !== "storeholder";
    }
    if (selectedRole === "storeholder") {
      loadHawkerCentres();
    }

    if (unitPreview) {
      unitPreview.value =
        selectedRole === "storeholder"
          ? "Unit No will be auto-generated after sign up"
          : "";
    }
  });
});

/* =========================
   Password show/hide
========================= */
function setupPasswordToggle(inputEl, btnEl, iconEl) {
 btnEl?.addEventListener("click", () => {
    const isHidden = inputEl.type === "password";
    inputEl.type = isHidden ? "text" : "password";
    iconEl.src = isHidden ? "images/show.png" : "images/hide.png";
    iconEl.alt = isHidden ? "Show password" : "Hide password";
    btnEl.setAttribute("aria-label", isHidden ? "Show password" : "Hide password");
   });
 }

 setupPasswordToggle(password, togglePasswordBtn, eyeIcon);
 setupPasswordToggle(
   document.getElementById("confirmPassword"),
   document.getElementById("toggleConfirmPassword"),
   document.getElementById("confirmEyeIcon"),
 );

/* =========================
   Validation helpers
========================= */
function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
function isPhone(v) {
  return /^[89]\d{7}$/.test(v.trim());
}

function clearErrors() {
  nameError.textContent = "";
  emailError.textContent = "";
  phoneError.textContent = "";
  pwError.textContent = "";
  statusMsg.textContent = "";

  if (stallCentreError) stallCentreError.textContent = "";
  if (stallNameError) stallNameError.textContent = "";
  if (stallCuisineError) stallCuisineError.textContent = "";
  if (confirmPwError) confirmPwError.textContent = "";
}

function validateBase() {
  clearErrors();
  let ok = true;

  if (!fullName.value.trim()) {
    nameError.textContent = "Please enter your full name.";
    ok = false;
  }
  if (!email.value.trim()) {
    emailError.textContent = "Please enter your email.";
    ok = false;
  } else if (!isEmail(email.value)) {
    emailError.textContent = "Please enter a valid email.";
    ok = false;
  }
  if (!phone.value.trim()) {
    phoneError.textContent = "Please enter your phone number.";
    ok = false;
  } else if (!isPhone(phone.value)) {
    phoneError.textContent = "Enter a valid SG phone (8 digits).";
    ok = false;
  }
  if (!password.value) {
    pwError.textContent = "Please enter a password.";
    ok = false;
  } else if (password.value.length < 6) {
    pwError.textContent = "Password must be at least 6 characters.";
    ok = false;
  }
  if (!confirmPassword?.value) {
    confirmPwError.textContent = "Please confirm your password.";
    ok = false;
  } else if (password.value !== confirmPassword.value) {
    confirmPwError.textContent = "Passwords do not match.";
    ok = false;
  }

  return ok;
}

function validateStoreholderExtra() {
  let ok = true;
  if (!stallCentreId?.value) {
    if (stallCentreError) stallCentreError.textContent = "Please select a hawker centre.";
    ok = false;
  }
  if (!stallName?.value?.trim()) {
    if (stallNameError) stallNameError.textContent = "Please enter your stall name.";
    ok = false;
  }
  if (!stallCuisine?.value.trim()) {
    if (stallCuisineError) stallCuisineError.textContent = "Please enter a cuisine.";
    ok = false;
  }
  return ok;
}

function validate() {
  const okBase = validateBase();
  if (!okBase) return false;
  if (selectedRole === "storeholder") return validateStoreholderExtra();
  return true;
}

/* =========================
   Submit
========================= */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validate()) return;

  statusMsg.textContent = "Creating account...";

  const payload = {
    name: fullName.value.trim(),
    email: email.value.trim(),
    phone: phone.value.trim(),
    password: password.value,
    confirmPassword: confirmPassword.value,
    role: selectedRole,
  };

  if (selectedRole === "storeholder") {
    payload.stallCentreId = stallCentreId.value;
    payload.stallName = stallName.value.trim();
    payload.stallCuisine = stallCuisine.value.trim();
  }

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (data.fields) {
        nameError.textContent = data.fields.name || "";
        emailError.textContent = data.fields.email || "";
        phoneError.textContent = data.fields.phone || "";
        pwError.textContent = data.fields.password || "";
        confirmPwError.textContent = data.fields.confirmPassword || "";
        if (stallCentreError) stallCentreError.textContent = data.fields.stallCentreId || "";
        if (stallNameError) stallNameError.textContent = data.fields.stallName || "";
        if (stallCuisineError) stallCuisineError.textContent = data.fields.stallCuisine || "";
      } else {
        statusMsg.textContent = `❌ ${data.error || "Sign up failed."}`;
      }
      return;
    }

    if (data.stall?.unitNo && unitPreview) {
      unitPreview.value = data.stall.unitNo;
    }

    statusMsg.textContent = data.warning
      ? `⚠️ ${data.warning}`
      : `✅ Account created as ${data.user.role}. Redirecting...`;

    setTimeout(() => {
      window.location.href = selectedRole === "storeholder" ? "stall-dashboard.html" : "home.html";
    }, 900);
  } catch (err) {
    console.error(err);
    statusMsg.textContent = "❌ Network error. Please try again.";
  }
});
