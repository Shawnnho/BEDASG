// =========================
// State
// =========================
let stalls = [];
let activeCat = "all";
let currentUid = null;
let favSet = new Set();

// =========================
// DOM
// =========================
const featuredTrack = document.getElementById("featuredTrack");
const listEl = document.getElementById("discoverList");
const emptyEl = document.getElementById("discoverEmpty");
const searchEl = document.getElementById("discoverSearch");
const chipRow = document.getElementById("chipRow");
const resetBtn = document.getElementById("discoverReset");

// =========================
// Helpers
// =========================
function isExpired(p) {
  return p.ExpiresAt && Date.now() > new Date(p.ExpiresAt).getTime();
}

function esc(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Modal shown when a guest tries to claim/redeem a promo. Self-contained —
// injects its own styles + DOM, no HTML/CSS changes needed.
function showLoginModal({
  title = "Login to claim",
  message = "Promo codes are for members. Log in or sign up free to claim this deal.",
} = {}) {
  if (!document.getElementById("hpPromoModalStyles")) {
    const style = document.createElement("style");
    style.id = "hpPromoModalStyles";
    style.textContent = `
      .hpModalBackdrop{position:fixed;inset:0;background:rgba(40,25,15,.55);
        display:flex;align-items:center;justify-content:center;z-index:9999;
        animation:hpFade .15s ease}
      @keyframes hpFade{from{opacity:0}to{opacity:1}}
      .hpModalCard{background:#fffdf8;max-width:400px;width:calc(100% - 48px);
        border-radius:18px;padding:28px 26px 22px;box-shadow:0 20px 60px rgba(0,0,0,.3);
        font-family:inherit;text-align:center;animation:hpPop .18s ease}
      @keyframes hpPop{from{transform:scale(.94);opacity:0}to{transform:scale(1);opacity:1}}
      .hpModalIcon{width:52px;height:52px;border-radius:50%;margin:0 auto 14px;
        background:#fbe4d6;display:flex;align-items:center;justify-content:center;font-size:26px}
      .hpModalTitle{font-size:19px;font-weight:700;color:#7a3e1d;margin:0 0 8px}
      .hpModalMsg{font-size:15px;line-height:1.5;color:#4a3a2c;margin:0 0 20px}
      .hpModalActions{display:flex;gap:10px;justify-content:center}
  .hpModalBtn{border:none;border-radius:12px;padding:11px 22px;font-size:15px;
        font-weight:600;cursor:pointer;font-family:inherit;transition:background .15s;
        display:inline-flex;align-items:center;justify-content:center;
        line-height:1;text-align:center}
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
  document.addEventListener("keydown", function onKey(ev) {
    if (ev.key === "Escape") {
      close();
      document.removeEventListener("keydown", onKey);
    }
  });

  document.body.appendChild(backdrop);
}

function showDToast(msg) {
  const el = document.getElementById("dToast");
  if (!el) return;

  el.textContent = msg;
  el.classList.add("show");

  clearTimeout(showDToast._t);
  showDToast._t = setTimeout(() => el.classList.remove("show"), 1400);
}

function timeLabel(s) {
  return `${s.prepMin}\u2013${s.prepMax} min`;
}

function prepClass(s) {
  if (s.prepMax <= 5) return "good";
  if (s.prepMax <= 10) return "ok";
  return "slow";
}

function catTokens(s) {
  const tokens = [];
  if (s.cuisine) tokens.push(s.cuisine.toLowerCase());
  if (s.popular) tokens.push("popular");
  if (s.grade === "A") tokens.push("top");
  if (s.prepMax <= 10) tokens.push("fast");
  return tokens.join(" ");
}

function menuUrl(s) {
  return `stall.html?centreId=${encodeURIComponent(s.centreId)}&stallId=${encodeURIComponent(s.stallDocId)}`;
}

// =========================
// Dynamic chip generation
// =========================
function buildChipsFromData(data) {
  const cuisines = [
    ...new Set(data.map((s) => (s.cuisine || "").trim()).filter(Boolean)),
  ];

  const cuisineBtns = cuisines
    .sort()
    .map((c) => {
      const key = c.toLowerCase();
      return `
      <button class="chipBtn" data-cat="${esc(key)}" type="button">
        ${esc(c)}
      </button>`;
    })
    .join("");

  const specialBtns = `
  <button class="chipBtn" data-cat="popular" type="button">Popular</button>
  <button class="chipBtn" data-cat="top" type="button">Top Rated</button>
  <button class="chipBtn" data-cat="fast" type="button">Fast</button>
`;

  chipRow.innerHTML = `
    <button class="chipBtn active" data-cat="all" type="button">All</button>
    ${cuisineBtns}
    ${specialBtns}
  `;
}

// =========================
// Render
// =========================
function renderFeatured(data) {
  const featured = data.filter((s) => s.popular);

  featuredTrack.innerHTML = featured
    .map((s) => {
      return `
      <a class="featuredCard" href="${menuUrl(s)}">
        <div class="featuredImg" style="background-image:url('${esc(s.img)}')"></div>
        <div class="featuredBody">
          <div class="featuredBadge">${s.grade === "A" ? "Top Pick" : "Popular"}</div>
          <div class="featuredName">${esc(s.name)}</div>
          <div class="featuredMeta">
    ${esc(s.cuisine)} \u00b7 Grade ${esc(s.grade)} \u00b7 Prep Time ${timeLabel(s)}
          </div>
        </div>
      </a>`;
    })
    .join("");
}

function renderList(data) {
  listEl.innerHTML = data
    .map((s) => {
      const favOn = favSet.has(s.id);
      return `
      <article class="card dCard" data-cat="${esc(catTokens(s))}">
        <div class="cardImg">
          <div class="imgFrame">
            <img src="${esc(s.img)}" alt="${esc(s.name)}" />
          </div>
        </div>

        <div class="cardBody">
          <div class="cardTop">
            <h3 class="title">${esc(s.name)}</h3>
            ${s.popular ? `<span class="badgePopular">Popular</span>` : ``}
          </div>

          <div class="meta">
            <span class="tag">${esc(s.cuisine)}</span>
            <span class="grade ${esc(s.grade)}">${esc(s.grade)}</span>
          </div>

          <p class="desc">${esc(s.desc)}</p>

          <div class="cardBottom">
           <span class="prep dPrep ${prepClass(s)}">Prep Time ${timeLabel(s)}</span>

           <button
            class="dFav ${favOn ? "on" : ""}"
            type="button"
            data-stall="${esc(s.id)}"
            aria-label="Favourite"
          >
            <img
              class="heartIcon"
              src="${favOn ? "images/heart.png" : "images/like.png"}"
              alt="Favourite"
            />
          </button>

              <a class="viewBtn" href="${menuUrl(s)}">
                View <span class="arrow">\u2192</span>
              </a>
            </div>
          </div>
        </div>
      </article>`;
    })
    .join("");
}

function renderPromoStrip(data) {
  const track = document.getElementById("promoTrack");
  if (!track) return;

  track.innerHTML = data
    .map(
      (p) => `
      <article class="promoCard">
        <a class="promoLink" href="promotions.html">
          <div class="promoImg" style="background-image:url('${esc(p.ImageUrl || "images/placeholder.png")}')"></div>
        </a>

        <div class="promoBody">
          <div class="promoTitle">${esc(p.PromoTitle)}</div>
          <div class="promoDesc">${esc(p.Desc)}</div>

          <div class="promoFooter">
            <div class="promoCode">${esc(p.PromoCode)}</div>
            <button class="promoClaimBtn" type="button" data-code="${esc(p.PromoCode)}">
              Claim
            </button>
          </div>
        </div>
      </article>
    `,
    )
    .join("");
}

function applyFilters() {
  const q = (searchEl?.value || "").trim().toLowerCase();
  const cards = Array.from(document.querySelectorAll(".dCard"));

  let visible = 0;
  for (const card of cards) {
    const cat = (card.getAttribute("data-cat") || "").toLowerCase();
    const text = card.innerText.toLowerCase();

    const okCat = activeCat === "all" || cat.includes(activeCat);
    const okQ = !q || text.includes(q);

    const show = okCat && okQ;
    card.style.display = show ? "" : "none";
    if (show) visible++;
  }

  emptyEl.hidden = visible !== 0;
}

// =========================
// API Fetch Logic (MVC Backend)
// =========================
async function loadDiscoverPromos() {
  try {
    const res = await fetch("/api/promotions");
    if (!res.ok) throw new Error("Failed to fetch promos");
    const discoverPromos = await res.json();

    const validPromos = discoverPromos
      .filter((p) => !isExpired(p))
      .sort((a, b) => (b.popular === true) - (a.popular === true))
      .sort((a, b) => (b.IsPopular === true) - (a.IsPopular === true))
      .slice(0, 6);

    renderPromoStrip(validPromos);
  } catch (err) {
    console.error("Error loading promotions:", err);
  }
}

async function loadStalls() {
  try {
    const res = await fetch("/api/stalls");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    stalls = await res.json();

    buildChipsFromData(stalls);
    renderFeatured(stalls);
    renderList(stalls);
    applyFilters();
  } catch (err) {
    console.error("Failed to load stalls:", err);
    showDToast("Could not load stalls.");
  }
}

async function loadFavourites() {
  if (!currentUid) return;
  try {
    const res = await AuthClient.apiFetch("/api/favstalls/get");
    if (res.ok) {
      const data = await res.json();
      favSet = new Set(data.favourites || []);
      renderList(stalls);
      applyFilters();
    }
  } catch (err) {
    console.error("Failed to load favourites", err);
  }
}

async function toggleFavourite(stallId) {
  if (!currentUid) {
    showLoginModal({
      title: "Login to save favourites",
      message: "Sign in or sign up free to save your favourite stalls.",
    });
    return;
  }

  const isFav = favSet.has(stallId);

  // Optimistic UI update (feels faster to the user)
  if (isFav) favSet.delete(stallId);
  else favSet.add(stallId);
  renderList(stalls);
  applyFilters();

  try {
    const url = isFav ? "/api/favstalls/delete" : "/api/favstalls/add";
    const res = await AuthClient.apiFetch(url, {
      method: isFav ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stallId }),
    });

    if (!res.ok) throw new Error("Failed to save");
  } catch (err) {
    console.error("Error toggling favourite:", err);
    // Revert UI if the API call fails
    if (isFav) favSet.add(stallId);
    else favSet.delete(stallId);
    renderList(stalls);
    applyFilters();
    showDToast("Failed to save favourite.");
  }
}

// =========================
// Events
// =========================
chipRow?.addEventListener("click", (e) => {
  const btn = e.target.closest(".chipBtn");
  if (!btn) return;

  activeCat = btn.dataset.cat || "all";

  chipRow
    .querySelectorAll(".chipBtn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");

  applyFilters();
});

searchEl?.addEventListener("input", applyFilters);

resetBtn?.addEventListener("click", () => {
  activeCat = "all";
  if (searchEl) searchEl.value = "";

  chipRow
    ?.querySelectorAll(".chipBtn")
    .forEach((b) => b.classList.remove("active"));
  chipRow?.querySelector('.chipBtn[data-cat="all"]')?.classList.add("active");

  applyFilters();
});

listEl?.addEventListener("click", (e) => {
  const favBtn = e.target.closest(".dFav");
  if (!favBtn) return;

  const stallId = favBtn.getAttribute("data-stall");
  if (!stallId) return;

  toggleFavourite(stallId);
});

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".promoClaimBtn");
  if (!btn) return;

  const code = btn.dataset.code;
  if (!code) return;

  // Guests can view promos but not claim them.
  if (!currentUid) {
    showLoginModal();
    return;
  }

  // Claiming a promo code is a client-side action app-wide (see promotions.js
  // claimVoucher) — there's no backend claim endpoint, codes are just applied
  // at checkout. Track claimed codes the same way so state is shared with
  // the full promotions page.
  const claimedCodes = new Set(
    JSON.parse(localStorage.getItem("hp_claimedCodes") || "[]"),
  );
  const upperCode = code.toUpperCase();
  if (claimedCodes.has(upperCode)) return;

  claimedCodes.add(upperCode);
  localStorage.setItem("hp_claimedCodes", JSON.stringify([...claimedCodes]));

  btn.textContent = "Claimed";
  btn.disabled = true;
  showDToast(`Claimed: ${upperCode}`);
});

// =========================
// Authentication & Init
// =========================
async function checkAuthStatus() {
  const user = await AuthClient.getCurrentUser();

  if (user) {
    currentUid = user.id;
    loadFavourites();
  } else {
    currentUid = null;
    favSet = new Set();
  }

  // Re-render UI based on auth state
  if (stalls.length > 0) {
    renderList(stalls);
    applyFilters();
  }
}

// Initial Data Load
checkAuthStatus();
loadStalls();
loadDiscoverPromos();
