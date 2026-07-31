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
      const refreshRes = await apiFetch("/api/auth/refresh", {
        method: "POST",
      });
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

async function isGuest() {
  const user = await AuthClient.getCurrentUser();
  return !user;
}

// Self-contained login modal (no HTML/CSS changes needed).
function showLoginModal({
  title = "Login required",
  message = "Please log in or sign up free to do that.",
} = {}) {
  if (!document.getElementById("hpFbModalStyles")) {
    const style = document.createElement("style");
    style.id = "hpFbModalStyles";
    style.textContent = `
      .hpModalBackdrop{position:fixed;inset:0;background:rgba(40,25,15,.55);
        display:flex;align-items:center;justify-content:center;z-index:9999;animation:hpFade .15s ease}
      @keyframes hpFade{from{opacity:0}to{opacity:1}}
      .hpModalCard{background:#fffdf8;max-width:400px;width:calc(100% - 48px);box-sizing:border-box;margin:0 auto;
        border-radius:18px;padding:28px 26px 22px;box-shadow:0 20px 60px rgba(0,0,0,.3);
        font-family:inherit;text-align:center;animation:hpPop .18s ease}
      @keyframes hpPop{from{transform:scale(.94);opacity:0}to{transform:scale(1);opacity:1}}
      .hpModalIcon{width:52px;height:52px;border-radius:50%;margin:0 auto 14px;
        background:#fbe4d6;display:flex;align-items:center;justify-content:center;font-size:26px}
      .hpModalTitle{font-size:19px;font-weight:700;color:#7a3e1d;margin:0 0 8px}
      .hpModalMsg{font-size:15px;line-height:1.5;color:#4a3a2c;margin:0 0 20px}
      .hpModalActions{display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap}
      .hpModalBtn{border:none;border-radius:12px;padding:11px 22px;font-size:15px;font-weight:600;
        cursor:pointer;font-family:inherit;transition:background .15s;display:inline-flex;
        align-items:center;justify-content:center;line-height:1;text-align:center;flex:0 0 auto;min-width:110px}
      .hpModalBtn.primary{background:#df8f3b;color:#fff}
      .hpModalBtn.primary:hover{background:#c97c2c}
      .hpModalBtn.ghost{background:#f0e6da;color:#7a3e1d}
      .hpModalBtn.ghost:hover{background:#e6d8c6}
    `;
    document.head.appendChild(style);
  }

  const backdrop = document.createElement("div");
  backdrop.className = "hpModalBackdrop";
  backdrop.innerHTML = `
    <div class="hpModalCard" role="dialog" aria-modal="true">
      <div class="hpModalIcon">&#128274;</div>
      <h3 class="hpModalTitle">${title}</h3>
      <p class="hpModalMsg">${message}</p>
      <div class="hpModalActions">
        <button class="hpModalBtn ghost" data-close>Not now</button>
        <button class="hpModalBtn primary" data-login>Log in</button>
      </div>
    </div>`;

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (ev) => {
    if (ev.target === backdrop || ev.target.hasAttribute("data-close")) close();
    if (ev.target.hasAttribute("data-login"))
      window.location.href = "signin.html";
  });
  document.body.appendChild(backdrop);
}

window.writeReview = async function () {
  if (await isGuest()) {
    return showLoginModal({
      title: "Login to write a review",
      message: "Sign in or sign up free to share your experience.",
    });
  }
  window.location.href = "review.html";
};

window.fileComplaint = async function () {
  if (await isGuest()) {
    return showLoginModal({
      title: "Login to file a complaint",
      message: "Sign in or sign up free to file a complaint.",
    });
  }
  window.location.href = "complaint.html";
};

window.viewHistory = async function () {
  if (await isGuest()) {
    return showLoginModal({
      title: "Login to view history",
      message: "Sign in or sign up free to see your feedback history.",
    });
  }
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
  for (let i = 0; i < emptyCount; i++)
    html += `<span class="star empty">★</span>`;

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
