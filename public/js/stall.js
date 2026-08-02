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
let stallHours = []; // [{ dayOfWeek, isClosed, openTime, closeTime }, ...]
let isFav = false;
let isLoggedIn = false;

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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

// Hours widget
const hoursToggle = document.getElementById("hoursToggle");
const hoursTodayLabel = document.getElementById("hoursTodayLabel");
const hoursTodayTime = document.getElementById("hoursTodayTime");
const hoursList = document.getElementById("hoursList");

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
  const centreLocation = centre.Location;

  if (locationEl) locationEl.textContent = centreName ? ` ${centreName}` : "";
  if (dirBtn) {
    dirBtn.href = centreLocation
      ? centreLocation
      : "https://www.google.com/maps?q=" +
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
  metaEl.textContent = `Unit #${stall.unit}`;
  contactEl.textContent = `Contact Stall: ${stall.phone ? formatPhoneNo(stall.phone) : "-"}`;

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

function formatPhoneNo(phone) {
  const formatted = phone.slice(0, 4) + "-" + phone.slice(4);
  return formatted;
}

// =========================
// Operating hours (StallHours table)
// =========================
async function loadStallHours() {
  try {
    const res = await fetch(`/api/stalls/${encodeURIComponent(stallId)}/hours`);
    if (!res.ok) {
      console.error("Failed to load stall hours:", res.status);
      return;
    }
    const data = await res.json();
    stallHours = Array.isArray(data.hours) ? data.hours : [];
    renderHoursWidget();
  } catch (e) {
    console.error("Failed to load stall hours:", e);
  }
}

function dayRowText(row) {
  if (!row) return "—";
  if (row.isClosed) return "Closed";
  return buildHours12(row.openTime, row.closeTime);
}

// Converts a TIME value (either "HH:MM[:SS]" or an ISO/UTC-serialized date
// string) into minutes-since-midnight, reusing parseTimeParts so this stays
// consistent with how the display labels are formatted.
function timeToMinutes(value) {
  const parts = parseTimeParts(value);
  if (!parts) return null;
  return parts.h * 60 + parts.m;
}

// Compares the current wall-clock time against a given day's OpenTime/CloseTime.
// Handles the normal same-day case (open < close) and overnight hours that
// cross midnight (close <= open, e.g. 18:00-02:00).
function isRowOpenNow(row) {
  if (!row || row.isClosed) return false;

  const openMin = timeToMinutes(row.openTime);
  const closeMin = timeToMinutes(row.closeTime);
  if (openMin === null || closeMin === null) return false;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (closeMin > openMin) {
    // Normal same-day window, e.g. 08:00-19:00
    return nowMin >= openMin && nowMin < closeMin;
  }
  // Overnight window, e.g. 18:00-02:00
  return nowMin >= openMin || nowMin < closeMin;
}

function renderHoursWidget() {
  if (!hoursToggle || !hoursList || stallHours.length === 0) return;

  const todayIdx = new Date().getDay();
  const byDay = new Map(stallHours.map((r) => [r.dayOfWeek, r]));
  const todayRow = byDay.get(todayIdx);
  const openNow = isRowOpenNow(todayRow);

  // Summary row (collapsed state) — shows LIVE open/closed status based on
  // the current time, not just today's configured hours. A stall can still
  // read "Closed" today if we're before opening or after closing.
  hoursTodayLabel.textContent = DAY_NAMES[todayIdx];
  hoursTodayTime.textContent = openNow ? "Stall Open" : "Stall Closed";
  hoursTodayTime.classList.remove("isOpenColor", "isClosedColor");
  hoursTodayTime.classList.add(openNow ? "isOpenColor" : "isClosedColor");

  // Expanded list, starting at today and wrapping through the week.
  // Each row still shows that day's configured hours (not live status),
  // colored by whether the stall is scheduled closed that day.
  hoursList.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const dayIdx = (todayIdx + i) % 7;
    const row = byDay.get(dayIdx);

    const line = document.createElement("div");
    line.className = "hoursListRow";
    if (dayIdx === todayIdx) line.classList.add("isToday");

    const dayEl = document.createElement("span");
    dayEl.className = "hoursDay";
    dayEl.textContent = DAY_NAMES[dayIdx];

    const timeEl = document.createElement("span");
    timeEl.className = `hoursTime ${row?.isClosed ? "isClosedColor" : "isOpenColor"}`;
    timeEl.textContent = dayRowText(row);

    line.appendChild(dayEl);
    line.appendChild(timeEl);
    hoursList.appendChild(line);
  }
}

function setupHoursToggle() {
  if (!hoursToggle || !hoursList) return;

  hoursToggle.addEventListener("click", () => {
    const expanded = hoursToggle.getAttribute("aria-expanded") === "true";
    hoursToggle.setAttribute("aria-expanded", String(!expanded));
    hoursList.hidden = expanded;
  });
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

// Modal shown when a guest tries to favourite a stall. Self-contained —
// injects its own styles + DOM, no HTML/CSS changes needed.
function showLoginModal({
  title = "Login to save favourites",
  message = "Sign in or sign up free to save your favourite stalls.",
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

function setupFavButton() {
  if (!favBtn) return;

  favBtn.addEventListener("click", async () => {
    if (!isLoggedIn) {
      showLoginModal({
        title: "Login to save favourites",
        message: "Sign in or sign up free to save your favourite stalls.",
      });
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
  setupHoursToggle();
  await loadStall();
  await loadStallHours();
  await loadFavStatus();
  setupFavButton();
})();