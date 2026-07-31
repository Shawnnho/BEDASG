/*************************************************
 * stall.js (module)
 * - Loads stall UI from MSSQL via REST API
 *************************************************/

// =========================
// URL params
// =========================
const params = new URLSearchParams(window.location.search);
const centreId = params.get("centreId");
const stallId = params.get("stallId");

if (!centreId || !stallId) {
  window.location.href = "home.html";
  throw new Error("Missing centreId/stallId — redirecting to home.html");
}

let stall = null;
let isFav = false;
let isLoggedIn = false;

// =========================
// DOM
// =========================
const heroEl = document.getElementById("stallHero");
const nameEl = document.getElementById("stallName");
const cuisineEl = document.getElementById("stallCuisine");
const gradeEl = document.getElementById("stallGrade");
const descEl = document.getElementById("stallDesc");
const metaEl = document.getElementById("stallMeta");
const contactEl = document.getElementById("stallContact");
const locationEl = document.getElementById("stallLocation");

const menuLink = document.getElementById("menuLink");
const callBtn = document.getElementById("callBtn");
const dirBtn = document.getElementById("dirBtn");

const favBtn = document.getElementById("favBtn");
const favIcon = document.getElementById("favIcon");

const avgText = document.getElementById("avgText");
const countText = document.getElementById("countText");
const starFill = document.getElementById("starFill");

const seeReviewLink = document.getElementById("seeReviewLink");
const hygBtn = document.getElementById("hygBtn");

const HEART_OUTLINE = "images/like.png";
const HEART_FILLED = "images/heart.png";

// =========================
// Helpers
// =========================
function parseTimeParts(value) {
  if (!value) return null;

  // Case 1: TIME column serialized as a Date/ISO string, e.g. "1970-01-01T07:00:00.000Z"
  if (typeof value === "string" && value.includes("T") && value.endsWith("Z")) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return { h: d.getUTCHours(), m: d.getUTCMinutes() };
    }
  }

  // Case 2: plain "HH:MM" or "HH:MM:SS" string
  if (typeof value === "string" && value.includes(":")) {
    const [hStr, mStr] = value.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (!isNaN(h) && !isNaN(m)) return { h, m };
  }

  return null;
}
function formatTime12(value) {
  const parts = parseTimeParts(value);
  if (!parts) return null;

  let { h, m } = parts;
  const period = h >= 12 ? "PM" : "AM";

  h = h % 12;
  if (h === 0) h = 12;

  const mm = String(m).padStart(2, "0");
  return `${h}:${mm} ${period}`;
}

function buildHours12(open, close) {
  const openFmt = formatTime12(open);
  const closeFmt = formatTime12(close);

  if (!openFmt || !closeFmt) return "—";
  return `${openFmt} – ${closeFmt}`;
}
// OperatingHours may come back as a JSON string (per-day open/close) or null.
// Falls back to the flat OpenTime/CloseTime columns if not present.
function resolveTodayHours(stall) {
  const dayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][
    new Date().getDay()
  ];

  let raw = stall.operatingHours;
  if (raw && typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }

  if (raw && typeof raw === "object" && raw[dayKey]) {
    return {
      open: raw[dayKey].open || "",
      close: raw[dayKey].close || "",
    };
  }

  return { open: stall.openTime || "", close: stall.closeTime || "" };
}

// centreModel's shape isn't known here, so check the common field names.
function resolveCentreName(centre) {
  return centre?.Name || "";
}

// =========================
// Fetch stall + centre
// =========================
async function loadStall() {
  const res = await fetch(`/api/stalls/${encodeURIComponent(stallId)}`);

  if (res.status === 404) {
    window.location.href = "home.html";
    return;
  }
  if (!res.ok) {
    console.error("Failed to load stall:", res.status);
    return;
  }

  const d = await res.json();
  const { open, close } = resolveTodayHours(d);

  stall = {
    id: d.id ?? stallId,
    centreId: d.centreId ?? centreId,
    name: d.name || stallId,
    cuisine: d.cuisine || "",
    grade: d.grade || "—",
    desc: d.desc || "",
    img: d.img || "images/default-stall.png",
    unit: d.unit || "",
    phone: d.phone || "",
    ratingCount: d.ratingCount,
    ratingTotal: d.ratingTotal,
    openTime: open,
    closeTime: close,
  };
  
  fillUI();
  loadCentreName().catch(console.error);
}

async function loadCentreName() {
  const res = await fetch(`/api/centres/${encodeURIComponent(centreId)}`);
  if (!res.ok) {
    console.error("Failed to load centre:", res.status);
    return;
  }
  const centre = await res.json();
  const centreName = resolveCentreName(centre);
  const centreLocation = centre.Location

  if (locationEl) locationEl.textContent = centreName ? ` ${centreName}` : "";
  if (dirBtn) {
    dirBtn.href = centreLocation ? centreLocation :
      "https://www.google.com/maps?q=" +
      encodeURIComponent(centreName || stall.name);
  }
}

function fillUI() {
  heroEl.src = stall.img;
  heroEl.alt = `${stall.name} hero image`;

  nameEl.textContent = stall.name;
  cuisineEl.textContent = stall.cuisine;

  gradeEl.textContent = stall.grade;
  gradeEl.classList.remove("gradeA", "gradeB", "gradeC", "gradeD");
  if (["A", "B", "C", "D"].includes(stall.grade)) {
    gradeEl.classList.add(`grade${stall.grade}`);
  }

  descEl.textContent = stall.desc;
  metaEl.textContent = `Opening Hours: ${buildHours12(stall.openTime, stall.closeTime)} • Unit #${stall.unit}`;
  contactEl.textContent =`Contact Stall: ${stall.phone ? formatPhoneNo(stall.phone) : "-"}`

  const hasRatings = stall.ratingCount > 0;
  if (avgText)
    avgText.textContent = hasRatings
      ? (stall.ratingTotal / stall.ratingCount).toFixed(1)
      : "—";
  if (countText) countText.textContent = `(${stall.ratingCount})`;
  if (starFill) {
    const pct = hasRatings
      ? Math.max(0, Math.min(100, ((stall.ratingTotal / stall.ratingCount) / 5) * 100))
      : 0;
    starFill.style.width = pct + "%";
  }

  if (menuLink)
    menuLink.href = `menu.html?centreId=${encodeURIComponent(centreId)}&stallId=${encodeURIComponent(stallId)}`;
  if (callBtn) {
    callBtn.href = stall.phone ? `tel:${stall.phone}` : "#";
  }
  if (seeReviewLink) {
    seeReviewLink.href = `feedback.html?id=${encodeURIComponent(stallId)}`;
  }
  if (hygBtn) {
    hygBtn.href = `hygiene.html?id=${encodeURIComponent(stallId)}&centreId=${encodeURIComponent(centreId)}`;
  }
}

function formatPhoneNo(phone){
  const formatted = phone.slice(0,4) + "-" + phone.slice(4);
  return formatted;
}

// =========================
// Favourites (MSSQL, cookie auth)
// =========================
function setFavUI(fav) {
  if (!favBtn || !favIcon) return;

  favBtn.classList.toggle("active", fav);
  favBtn.setAttribute("aria-pressed", String(fav));
  favBtn.setAttribute(
    "aria-label",
    fav ? "Remove favourite" : "Add to favourite",
  );

  favIcon.src = fav ? HEART_FILLED : HEART_OUTLINE;
  favIcon.alt = fav ? "Remove from favourite" : "Add to favourite";
}

async function loadFavStatus() {
  try {
    const res = await fetch("/api/favstalls/get", {
      credentials: "include",
    });

    if (res.status === 401 || res.status === 403) {
      isLoggedIn = false;
      setFavUI(false);
      return;
    }

    if (!res.ok) {
      console.error("Failed to load favourites:", res.status);
      return;
    }

    isLoggedIn = true;
    const data = await res.json();
    const favourites = Array.isArray(data.favourites) ? data.favourites : [];
    isFav = favourites.includes(stallId);
    setFavUI(isFav);
  } catch (e) {
    console.error("Failed to load favourites:", e);
    setFavUI(false);
  }
}

function setupFavButton() {
  if (!favBtn) return;

  favBtn.addEventListener("click", async () => {
    if (!isLoggedIn) {
      alert("Please login to use favourites.");
      window.location.href = "signin.html";
      return;
    }

    const wantFav = !isFav;
    isFav = wantFav;
    setFavUI(isFav);

    try {
      const res = await fetch(
        wantFav ? "/api/favstalls/add" : "/api/favstalls/delete",
        {
          method: wantFav ? "POST" : "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stallId }),
        },
      );

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    } catch (e) {
      console.error("Failed to update favourite:", e);
      // rollback
      isFav = !wantFav;
      setFavUI(isFav);
      alert("Failed to update favourite. Try again.");
    }
  });
}

// =========================
// Init
// =========================
(async function init() {
  await loadStall();
  await loadFavStatus();
  setupFavButton();
})();