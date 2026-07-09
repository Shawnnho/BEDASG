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
  return p.expiresAt && Date.now() > p.expiresAt;
}

function esc(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
          <div class="promoImg" style="background-image:url('${esc(
            p.img || "images/stalls/feature1.jpg",
          )}')"></div>
        </a>

        <div class="promoBody">
          <div class="promoTitle">${esc(p.title)}</div>
          <div class="promoDesc">${esc(p.desc)}</div>

          <div class="promoFooter">
            <div class="promoCode">${esc(p.code)}</div>
            <button class="promoClaimBtn" type="button" data-code="${esc(p.code)}">
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
    const res = await fetch("/api/users/favourites", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
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
    showDToast("Please sign in to save favourites.");
    return;
  }

  const isFav = favSet.has(stallId);

  // Optimistic UI update (feels faster to the user)
  if (isFav) favSet.delete(stallId);
  else favSet.add(stallId);
  renderList(stalls);
  applyFilters();

  try {
    const res = await fetch("/api/users/favourites", {
      method: isFav ? "DELETE" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
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

  if (!currentUid) {
    showDToast("Please sign in to claim this promotion.");
    setTimeout(() => (window.location.href = "signin.html?from=guest"), 650);
    return;
  }

  btn.textContent = "Claiming...";

  try {
    const res = await fetch("/api/users/claim-promo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ code }),
    });

    if (res.ok) {
      btn.textContent = "Claimed";
      btn.disabled = true;
    } else {
      btn.textContent = "Claim";
      showDToast("Failed to claim promotion.");
    }
  } catch (err) {
    btn.textContent = "Claim";
    showDToast("Error claiming promotion.");
  }
});

// =========================
// Authentication & Init
// =========================
function checkAuthStatus() {
  const token = localStorage.getItem("token");

  if (token) {
    try {
      // Decode JWT payload to get user details
      const payload = JSON.parse(atob(token.split(".")[1]));
      currentUid = payload.userId || "authorized_user";
      loadFavourites();
    } catch (e) {
      console.error("Invalid token format");
      currentUid = null;
      favSet = new Set();
    }
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

// Handle Guest Mode URL Param
const params = new URLSearchParams(window.location.search);
if (params.get("mode") === "guest") {
  localStorage.removeItem("token");
  currentUid = null;
}

// Initial Data Load
checkAuthStatus();
loadStalls();
loadDiscoverPromos();
