/*
  review.js — uses AuthClient (cookie-based auth) instead of
  localStorage/JWT decoding. Requires authClient.js loaded BEFORE this
  script on review.html:
    <script src="authClient.js"></script>
    <script src="review.js"></script>

  Same element ids as your original review.html, so no other HTML
  changes needed.
*/

const submitBtn = document.getElementById("submit-btn");
if (submitBtn) submitBtn.disabled = true;

let currentUser = null;

(async function initAuth() {
  currentUser = await AuthClient.getCurrentUser();

  if (!currentUser) {
    alert("Please log in to submit a review.");
    window.location.href = "signin.html";
    return;
  }

  if (submitBtn) submitBtn.disabled = false;
  loadStallsIntoSelect();
})();

/* =========================
   Stall select — GET /api/stalls
========================= */
const stallSelect = document.getElementById("stall-select");
const stallTitle = document.getElementById("selected-stall-text");

async function loadStallsIntoSelect() {
  if (!stallSelect) return;

  stallSelect.innerHTML = `<option value="" disabled selected>Loading stalls...</option>`;

  try {
    const res = await fetch("/api/stalls");
    if (!res.ok) throw new Error("Failed to load stalls");
    const stalls = await res.json(); // [{ id, name, ... }] — already IsActive/IsCanonical filtered server-side

    const sorted = [...stalls].sort((a, b) => a.name.localeCompare(b.name));

    if (!sorted.length) {
      stallSelect.innerHTML = `<option value="" disabled selected>No stalls found</option>`;
      return;
    }

    stallSelect.innerHTML = `
      <option value="" disabled selected>Select a stall</option>
      ${sorted.map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}
    `;
  } catch (err) {
    console.error("Failed to load stalls:", err);
    stallSelect.innerHTML = `<option value="" disabled selected>Failed to load stalls</option>`;
  }
}

stallSelect?.addEventListener("change", () => {
  stallTitle.textContent = stallSelect.options[stallSelect.selectedIndex].text;
});

/* =========================
   Quick tags
========================= */
const tagWrap = document.getElementById("quickTags");
const selectedTags = new Set();

tagWrap?.addEventListener("click", (e) => {
  const btn = e.target.closest(".tagChip");
  if (!btn) return;

  const tag = btn.dataset.tag;

  if (selectedTags.has(tag)) {
    selectedTags.delete(tag);
    btn.classList.remove("isOn");
    return;
  }

  if (selectedTags.size >= 3) return;

  selectedTags.add(tag);
  btn.classList.add("isOn");
});

function getSelectedTags() {
  return Array.from(selectedTags);
}

/* =========================
   Character counter
========================= */
const textEl = document.getElementById("review-text");
const charCountEl = document.getElementById("charCount");
const MAX_CHARS = 500;

function updateCounter() {
  if (!textEl || !charCountEl) return;

  if (textEl.value.length > MAX_CHARS) {
    textEl.value = textEl.value.slice(0, MAX_CHARS);
  }

  charCountEl.textContent = `${textEl.value.length} / ${MAX_CHARS}`;
}

textEl?.addEventListener("input", updateCounter);
updateCounter();

/* =========================
   Anonymous toggle
========================= */
const anonToggle = document.getElementById("anonToggle");
function isAnonymous() {
  return !!anonToggle?.checked;
}

/* =========================
   Submit button state
========================= */
function setSubmitState(state) {
  const btn = document.getElementById("submit-btn");
  if (!btn) return;

  btn.classList.remove("isLoading", "isSuccess");

  if (state === "loading") {
    btn.disabled = true;
    btn.textContent = "Submitting";
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
  btn.textContent = "Submit Feedback";
}

/* =========================
   Image preview
========================= */
const imgInput = document.getElementById("review-image");
const imgPreviewWrap = document.getElementById("imgPreviewWrap");
const imgPreview = document.getElementById("imgPreview");
const removeImgBtn = document.getElementById("removeImgBtn");

if (imgInput && imgPreviewWrap && imgPreview) {
  imgInput.addEventListener("change", () => {
    const file = imgInput.files && imgInput.files[0];
    if (!file) {
      imgPreviewWrap.style.display = "none";
      imgPreview.src = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      imgPreviewWrap.style.display = "none";
      imgPreview.src = "";
      alert("Please choose an image file.");
      imgInput.value = "";
      return;
    }

    const url = URL.createObjectURL(file);
    imgPreview.src = url;
    imgPreview.onload = () => URL.revokeObjectURL(url);
    imgPreviewWrap.style.display = "flex";
  });

  if (removeImgBtn) {
    removeImgBtn.addEventListener("click", () => {
      imgInput.value = "";
      imgPreview.src = "";
      imgPreviewWrap.style.display = "none";
    });
  }
}

/* =========================
   Star selection (1–5)
========================= */
let selectedRating = 0;

const starContainer = document.getElementById("star-container");
if (starContainer) {
  const stars = starContainer.querySelectorAll(".star");

  stars.forEach((star) => {
    star.addEventListener("click", () => {
      selectedRating = Number(star.dataset.value);

      stars.forEach((s) => s.classList.remove("active"));
      stars.forEach((s) => {
        if (Number(s.dataset.value) <= selectedRating) {
          s.classList.add("active");
        }
      });
    });
  });
}

// Reads a File as a base64 data URL — replaces multer's multipart upload.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* =========================================
   Submit — POST /api/reviews (application/json, cookie auth)
========================================= */
window.submitReview = async function submitReview() {
  if (!currentUser) {
    alert("You must be logged in to submit a review.");
    return;
  }

  const input = document.getElementById("review-text");
  const stall = document.getElementById("stall-select");
  const error = document.getElementById("error-msg");
  const imageInput = document.getElementById("review-image");

  // ---------- Validation (same rules as before) ----------
  if (!stall.value) {
    error.innerText = "Please select a stall";
    error.style.display = "block";
    return;
  }

  if (!selectedRating) {
    error.innerText = "Please tap a star rating";
    error.style.display = "block";
    return;
  }

  if (input.value.trim() === "") {
    error.innerText = "Please enter your review";
    error.style.display = "block";
    return;
  }

  const file = imageInput?.files?.[0];
  if (file && file.size > 5 * 1024 * 1024) {
    error.innerText = "Image too large (max 5MB)";
    error.style.display = "block";
    return;
  }

  error.style.display = "none";
  setSubmitState("loading");

  try {
    const imageBase64 = file ? await fileToBase64(file) : null;

    const res = await AuthClient.apiFetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stallId: stall.value,
        rating: selectedRating,
        reviewText: input.value.trim(),
        isAnonymous: isAnonymous(),
        tags: getSelectedTags(),
        image: imageBase64,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to submit review.");
    }

    setSubmitState("success");

    setTimeout(() => {
      window.location.href = "feedback.html";
    }, 1000);
  } catch (err) {
    console.error(err);
    error.innerText = err?.message || "Failed to submit review. Try again.";
    error.style.display = "block";
    setSubmitState("idle");
  }
};