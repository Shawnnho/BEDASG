

let currentUser = null;

(async function initAuth() {
  currentUser = await AuthClient.getCurrentUser();

  if (!currentUser) {
    alert("Please log in to submit a complaint.");
    window.location.href = "signin.html";
    return;
  }

  const emailField = document.getElementById("comp-email");
  if (emailField && currentUser.email) emailField.value = currentUser.email;

  loadStalls();
})();

function setSubmitState(state) {
  const btn = document.getElementById("submit-btn");
  if (!btn) return;

  btn.classList.remove("isLoading", "isSuccess");

  if (state === "loading") {
    btn.disabled = true;
    btn.textContent = "Submitting…";
    btn.classList.add("isLoading");
    return;
  }

  if (state === "success") {
    btn.disabled = true;
    btn.textContent = "✅ Submitted";
    btn.classList.add("isSuccess");
    return;
  }

  btn.disabled = false;
  btn.textContent = "Submit a Complaint";
}

// Image preview logic — unchanged, purely client-side
const imgInput = document.getElementById("comp-img");
const imgPreview = document.getElementById("comp-img-preview");

if (imgInput && imgPreview) {
  imgInput.addEventListener("change", () => {
    const file = imgInput.files?.[0];
    if (!file) {
      imgPreview.style.display = "none";
      imgPreview.src = "";
      return;
    }
    const url = URL.createObjectURL(file);
    imgPreview.src = url;
    imgPreview.style.display = "block";
    imgPreview.onload = () => URL.revokeObjectURL(url);
  });
}

/* =========================================
   SELECT STALL — GET /api/stalls
========================================= */
async function loadStalls() {
  const select = document.getElementById("comp-stall");
  if (!select) return;

  select.innerHTML = `<option value="" disabled selected>Loading stalls...</option>`;

  try {
    const res = await fetch("/api/stalls");
    if (!res.ok) throw new Error("Failed to load stalls");
    const stalls = await res.json(); // [{ id, name, ... }]

    const seen = new Set();
    const deduped = [];
    for (const s of stalls) {
      const key = (s.name || "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push(s);
    }
    deduped.sort((a, b) => a.name.localeCompare(b.name));

    if (!deduped.length) {
      select.innerHTML = `<option value="" disabled selected>No stalls found</option>`;
      return;
    }

    select.innerHTML = `
      <option value="" disabled selected>Select a stall</option>
      ${deduped.map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}
    `;
  } catch (err) {
    console.error("Failed to load stalls:", err);
    select.innerHTML = `<option value="" disabled selected>Failed to load stalls</option>`;
  }
}

// Reads a File as a base64 data URL (e.g. "data:image/png;base64,...")
// — this replaces multer's multipart file upload entirely.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* =========================================
   SUBMIT — POST /api/complaints (application/json, cookie auth)
========================================= */
window.submitComplaint = async function () {
  if (!currentUser) {
    alert("You must be logged in to submit a complaint.");
    return;
  }

  const stallSelect = document.getElementById("comp-stall");
  const first = document.getElementById("comp-first");
  const last = document.getElementById("comp-last");
  const email = document.getElementById("comp-email");
  const msg = document.getElementById("comp-msg");
  const imgInputEl = document.getElementById("comp-img");
  const error = document.getElementById("error-msg");

  if (!stallSelect?.value || !first?.value || !last?.value || !email?.value || !msg?.value) {
    error.style.display = "block";
    error.textContent = "Please fill in all fields";
    return;
  }

  error.style.display = "none";
  setSubmitState("loading");

  try {
    const file = imgInputEl?.files?.[0];
    if (file && file.size > 5 * 1024 * 1024) {
      throw new Error("Image too large (max 5MB).");
    }

    const stallNameText = stallSelect.options[stallSelect.selectedIndex].text;
    const imageBase64 = file ? await fileToBase64(file) : null;

    // AuthClient.apiFetch sends credentials:"include" for us — the
    // accessToken cookie goes along automatically.
    const res = await AuthClient.apiFetch("/api/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stall: stallSelect.value,
        stallName: stallNameText,
        firstName: first.value.trim(),
        lastName: last.value.trim(),
        email: email.value.trim(),
        message: msg.value.trim(),
        image: imageBase64,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to submit complaint.");
    }

    setSubmitState("success");

    setTimeout(() => {
      window.location.href = "feedback.html";
    }, 2000);
  } catch (err) {
    console.error("Submission Error:", err);
    error.textContent = err?.message || "Failed to submit. Please try again.";
    error.style.display = "block";
    setSubmitState("idle");
  }
};