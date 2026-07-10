const AuthClient = (function () {
  async function apiFetch(url, options = {}) {
    // credentials: "include" ensures cookies are sent even if you ever move
    // the front-end to a different subdomain/port than the API.
    return fetch(url, { ...options, credentials: "include" });
  }

  // Returns the logged-in user object, or null if not logged in.
  // Automatically tries ONE silent refresh if the access token has expired,
  // so a page load a few minutes into a session doesn't just log the user out.
  async function getCurrentUser() {
    let res = await apiFetch("/api/auth/me");

    if (res.status === 401 || res.status === 403) {
      const refreshRes = await apiFetch("/api/auth/refresh", { method: "POST" });
      if (refreshRes.ok) {
        res = await apiFetch("/api/auth/me");
      }
    }

    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data ? data.user : null;
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
  }

  return { apiFetch, getCurrentUser, logout };
})();


window.writeReview = function () {
  window.location.href = "review.html";
};

window.fileComplaint = function () {
  window.location.href = "complaint.html";
};

window.viewHistory = function () {
  window.location.href = "feedback_history.html";
};

/* =========================
   Carousel rendering
========================= */
const track = document.getElementById("fbTrack");
const emptyEl = document.getElementById("fbEmpty");
const prevBtn = document.getElementById("fbPrev");
const nextBtn = document.getElementById("fbNext");

function esc(s = "") {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

function renderStars(rating = 0) {
  const r = Math.max(0, Math.min(5, Number(rating)));
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  let html = "";

  for (let i = 0; i < full; i++) html += `<span class="star full">★</span>`;
  if (half) html += `<span class="star half">★</span>`;

  const emptyCount = 5 - full - (half ? 1 : 0);
  for (let i = 0; i < emptyCount; i++) html += `<span class="star empty">★</span>`;

  return html;
}

function fmtDate(ts) {
  try {
    const d = new Date(ts); // SQL DATETIME comes back as an ISO string over JSON
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function renderCards(items) {
  if (!track) return;

  track.innerHTML = "";

  if (!items.length) {
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  if (emptyEl) emptyEl.hidden = true;

  for (const it of items) {
    const stallName = it.StallName || it.StallId || "Unknown stall";
    const rating = Number(it.Rating || 0);
    const text = it.ReviewText || "";
    const user = it.IsAnonymous ? "Anonymous" : it.UserName || "Anonymous";
    const when = fmtDate(it.CreatedAt);
    const imageUrl = it.ImageUrl || null;

    const card = document.createElement("article");
    card.className = "fbCard";
    card.innerHTML = `
      <div class="fbCardTop">
        <div class="fbStallName">${esc(stallName)}</div>

        <div class="fbRating">
          <span class="fbStars" aria-label="${rating} out of 5">
            ${renderStars(rating)}
          </span>
          <span class="fbRatingNum">${rating ? rating.toFixed(1) : "0.0"}</span>
        </div>
      </div>

      ${imageUrl ? `<img src="${imageUrl}" alt="Review image" class="fbReviewImg" loading="lazy" />` : ""}

      <p class="fbText">${esc(text)}</p>

      <div class="fbMeta">
        <span class="fbUser">${esc(user)}</span>
        <span class="fbDot">•</span>
        <span class="fbDate">${esc(when)}</span>
      </div>
    `;

    card.style.cursor = "pointer";

    const imgEl = card.querySelector(".fbReviewImg");
    if (imgEl) {
      imgEl.style.cursor = "zoom-in";
      imgEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openImgModal(imgEl.src);
      });
    }

    track.appendChild(card);
  }
}

function scrollByOne(direction) {
  if (!track) return;
  const card = track.querySelector(".fbCard");
  const cardW = card ? card.getBoundingClientRect().width : 320;
  track.scrollBy({ left: direction * (cardW + 14), behavior: "smooth" });
}

if (prevBtn) prevBtn.addEventListener("click", () => scrollByOne(-1));
if (nextBtn) nextBtn.addEventListener("click", () => scrollByOne(1));

let autoTimer = null;
function startAuto() {
  stopAuto();
  autoTimer = setInterval(() => scrollByOne(1), 4000);
}
function stopAuto() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = null;
}
if (track) {
  track.addEventListener("mouseenter", stopAuto);
  track.addEventListener("mouseleave", startAuto);
}

/* =========================
   Load latest reviews (public endpoint, no auth needed)
========================= */
async function loadLatestReviews() {
  try {
    const res = await fetch("/api/reviews/latest?limit=20");
    if (!res.ok) throw new Error("Failed to load reviews");
    const items = await res.json();
    renderCards(items);
    startAuto();
  } catch (err) {
    console.error("Failed to load reviews:", err);
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent = "Couldn't load reviews right now.";
    }
  }
}

loadLatestReviews();

// Optional: poll for new reviews every 30s instead of Firestore's realtime push
// setInterval(loadLatestReviews, 30000);

/* =========================
   Image preview modal
========================= */
const imgModal = document.getElementById("imgModal");
const imgModalBackdrop = document.getElementById("imgModalBackdrop");
const imgModalContent = document.getElementById("imgModalContent");
const imgModalClose = document.getElementById("imgModalClose");

function openImgModal(src) {
  if (!imgModal || !imgModalContent) return;
  imgModalContent.src = src;
  imgModal.hidden = false;
}

function closeImgModal() {
  if (!imgModal || !imgModalContent) return;
  imgModal.hidden = true;
  imgModalContent.src = "";
}

imgModalBackdrop?.addEventListener("click", closeImgModal);
imgModalClose?.addEventListener("click", closeImgModal);
imgModalContent?.addEventListener("click", closeImgModal);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && imgModal && !imgModal.hidden) closeImgModal();
});

track?.addEventListener("click", (e) => {
  const img = e.target.closest(".fbReviewImg");
  if (!img) return;
  e.preventDefault();
  e.stopPropagation();
  openImgModal(img.src);
});