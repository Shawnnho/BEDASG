// =========================
// State
// =========================
let stalls = [];
let currentUid = null;
let favSet = new Set();

// =========================
// DOM
// =========================
const listEl = document.getElementById("list");
const sublineEl = document.getElementById("subline");
const qEl = document.getElementById("q");
const cuisineEl = document.getElementById("cuisine");
const gradeEl = document.getElementById("grade");
const sortEl = document.getElementById("sort");
const locationEl = document.getElementById("location");

// =========================
// Helpers
// =========================
function esc(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timeLabel(s) {
  return `${s.prepMin}\u2013${s.prepMax} min`;
}

function prepClass(s) {
  if (s.prepMax <= 5) return "good";
  if (s.prepMax <= 10) return "ok";
  return "slow";
}

function menuUrl(s) {
  return `stall.html?centreId=${encodeURIComponent(s.centreId)}&stallId=${encodeURIComponent(s.stallDocId)}`;
}

function sortLabel(value) {
  switch (value) {
    case "prepAsc":
      return "Fastest Prep";
    case "prepDesc":
      return "Slowest Prep";
    case "nameAsc":
      return "Name (A\u2013Z)";
    default:
      return "Most Popular";
  }
}

// =========================
// Dynamic filter options
// =========================
function populateCuisineOptions(data) {
  if (!cuisineEl) return;

  const cuisines = [
    ...new Set(data.map((s) => (s.cuisine || "").trim()).filter(Boolean)),
  ].sort();

  const current = cuisineEl.value;

  cuisineEl.innerHTML =
    `<option value="">Cuisine</option>` +
    cuisines
      .map(
        (c) =>
          `<option value="${esc(c.toLowerCase())}">${esc(c)}</option>`,
      )
      .join("");

  // Preserve selection if it still exists after reload
  if (current && cuisines.some((c) => c.toLowerCase() === current)) {
    cuisineEl.value = current;
  }
}

// =========================
// Render
// =========================
function renderCard(s) {
  const favOn = favSet.has(s.id);

  return `
    <article class="card" data-stall-id="${esc(s.id)}">
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
            class="dFav ${favOn ? "on" : ""} favBtn"
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
    </article>`;
}

function renderList(data) {
  listEl.innerHTML = data.map(renderCard).join("");
}

// =========================
// Filtering / Sorting
// =========================
function getFilteredStalls() {
  let out = stalls.slice();

  const q = (qEl?.value || "").trim().toLowerCase();
  const cuisine = (cuisineEl?.value || "").toLowerCase();
  const grade = gradeEl?.value || "";
  const loc = (locationEl?.value || "").trim().toLowerCase();

  if (q) {
    out = out.filter((s) =>
      `${s.name} ${s.desc} ${s.cuisine}`.toLowerCase().includes(q),
    );
  }

  if (cuisine) {
    out = out.filter((s) => (s.cuisine || "").toLowerCase() === cuisine);
  }

  if (grade) {
    out = out.filter((s) => s.grade === grade);
  }

  if (loc) {
    out = out.filter((s) =>
      (s.location || s.address || "").toLowerCase().includes(loc),
    );
  }

  const sortVal = sortEl?.value || "popular";
  switch (sortVal) {
    case "prepAsc":
      out.sort((a, b) => a.prepMin - b.prepMin);
      break;
    case "prepDesc":
      out.sort((a, b) => b.prepMax - a.prepMax);
      break;
    case "nameAsc":
      out.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      out.sort((a, b) => (b.popular === true) - (a.popular === true));
  }

  return out;
}

function applyFilters() {
  const data = getFilteredStalls();
  renderList(data);

  if (sublineEl) {
    const count = data.length;
    sublineEl.textContent = `Showing ${count} stall${count === 1 ? "" : "s"}. Sorted by ${sortLabel(sortEl?.value)}`;
  }
}

// =========================
// API Fetch Logic
// =========================
async function loadStalls() {
  try {
    const res = await fetch("/api/stalls");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    stalls = await res.json();

    populateCuisineOptions(stalls);
    applyFilters();
  } catch (err) {
    console.error("Failed to load stalls:", err);
    listEl.innerHTML = `<p style="text-align:center;font-weight:800;opacity:.7;">Could not load stalls. Please try again later.</p>`;
  }
}

async function loadFavourites() {
  if (!currentUid) return;
 
  try {
    const res = await AuthClient.apiFetch("/api/favstalls/get");
    if (res.ok) {
      const data = await res.json();
      favSet = new Set(data.favourites || []);
      applyFilters();
    }
  } catch (err) {
    console.error("Failed to load favourites:", err);
  }
}

async function toggleFavourite(stallId) {
  if (!currentUid) return;
 
  const isFav = favSet.has(stallId);
 
  // Optimistic UI update
  if (isFav) favSet.delete(stallId);
  else favSet.add(stallId);
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
    // Revert on failure
    if (isFav) favSet.add(stallId);
    else favSet.delete(stallId);
    applyFilters();
  }
}
// =========================
// Events
// =========================
qEl?.addEventListener("input", applyFilters);
cuisineEl?.addEventListener("change", applyFilters);
gradeEl?.addEventListener("change", applyFilters);
sortEl?.addEventListener("change", applyFilters);
locationEl?.addEventListener("input", applyFilters);

listEl?.addEventListener("click", (e) => {
  const favBtn = e.target.closest(".dFav");
  if (!favBtn) return;
  const stallId = favBtn.getAttribute("data-stall");
  if (!stallId) return;
  toggleFavourite(stallId);
});

// =========================
// Auth & Init
// =========================
async function checkAuthStatus() {
  const user = await AuthClient.getCurrentUser();
 
  if (user) {
    currentUid = user.id;
    loadFavourites();
  } else {
    currentUid = null;
    favSet = new Set();
    applyFilters();
  }
}

checkAuthStatus();
loadStalls();