// stall-review.js — MSSQL / Express version
// Loads reviews for the logged-in stall owner from GET /api/reviews/my-stall
// Red dot on the sidebar badge only when a review is newer than last seen.

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? "—";
}

function setStatus(msg) {
  const el = $("statusText");
  if (el) el.textContent = msg || "";
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stars(n) {
  const r = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
  return "★".repeat(r) + "☆".repeat(5 - r);
}

function setBadge(count) {
  const badge = $("reviewBadge");
  if (!badge) return;

  const n = Number(count) || 0;

  if (n <= 0) {
    badge.style.display = "none";
    return;
  }

  badge.style.display = "grid";
  badge.textContent = String(n);
}

function safeTags(tagsJson) {
  if (!tagsJson) return [];
  try {
    const parsed = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ---------- state ---------- */
let allReviews = [];
let lastSeenMs = 0;
let latestMs = 0;
let currentUserId = null;

function storageKey(uid) {
  return `hp:lastSeenReviewMs:${uid}`;
}

function loadLastSeen(uid) {
  const ms = Number(localStorage.getItem(storageKey(uid)));
  return Number.isFinite(ms) ? ms : 0;
}

function saveLastSeen(uid, ms) {
  localStorage.setItem(storageKey(uid), String(ms || 0));
}

/* ---------- render ---------- */
function render() {
  const listEl = $("reviewsList");
  const sumEl = $("summaryRow");
  if (!listEl || !sumEl) return;

  const sortMode = $("sortSelect")?.value || "newest";
  const photoOnly = !!$("photoOnly")?.checked;

  let list = [...allReviews];
  if (photoOnly) list = list.filter((r) => !!r.imageUrl);

  list.sort((a, b) => {
    const ta = a.createdAtMs || 0;
    const tb = b.createdAtMs || 0;
    const ra = Number(a.rating) || 0;
    const rb = Number(b.rating) || 0;

    if (sortMode === "oldest") return ta - tb;
    if (sortMode === "rating_desc") return rb - ra || tb - ta;
    if (sortMode === "rating_asc") return ra - rb || tb - ta;
    return tb - ta; // newest
  });

  const count = list.length;

  if (count === 0) {
    setBadge(0, false);
    sumEl.innerHTML = `
      <div class="rvEmptyHero">
        <div class="rvEmptyTitle">No reviews yet</div>
        <div class="rvEmptySub">When customers leave feedback, it'll show up here.</div>
      </div>
    `;
    listEl.innerHTML = "";
    return;
  }

  const total = list.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
  const avg = total / count;

  sumEl.innerHTML = `
    <div class="rvSummary">
      <div class="rvSummaryBig">${avg.toFixed(1)}</div>
      <div class="rvSummaryText">
        <div>${esc(stars(avg))} <span class="rvMuted">(${count})</span></div>
        <div class="rvMuted">${count} review${count === 1 ? "" : "s"}</div>
      </div>
    </div>
  `;

  setBadge(count, latestMs > lastSeenMs);

  listEl.innerHTML = list
    .map((r) => {
      const date = r.createdAtMs
        ? new Date(r.createdAtMs).toLocaleString()
        : "—";

      const tagHtml = r.tags.length
        ? `<div class="rvTags">${r.tags
            .map((t) => `<span class="rvTag">${esc(t)}</span>`)
            .join("")}</div>`
        : "";

      return `
        <div class="rvCard">
          <div class="rvTop">
            <div class="rvAvatar">${esc((r.userName || "A").charAt(0).toUpperCase())}</div>
            <div class="rvIdent">
              <div class="rvName">${esc(r.userName || "Anonymous")}</div>
              <div class="rvStars">
                ${esc(stars(r.rating))}
                <span class="rvMuted">${esc(r.rating)}/5</span>
              </div>
            </div>
          </div>

          <div class="rvDate">${esc(date)}</div>

          ${r.comment ? `<div class="rvComment">${esc(r.comment)}</div>` : ""}
          ${tagHtml}
          ${
            r.imageUrl
              ? `<img class="rvImg" src="${esc(r.imageUrl)}" alt="Review image" loading="lazy" />`
              : ""
          }
        </div>
      `;
    })
    .join("");
}

/* ---------- data ---------- */
function mapRow(row) {
  return {
    id: row.ReviewId,
    rating: Number(row.Rating) || 0,
    comment: row.ReviewText || "",
    userName: row.IsAnonymous ? "Anonymous" : row.UserName || "Anonymous",
    imageUrl: row.ImageUrl || "",
    tags: safeTags(row.TagsJson),
    createdAtMs: row.CreatedAt ? new Date(row.CreatedAt).getTime() : 0,
  };
}

async function loadReviews() {
  setStatus("Loading reviews...");

  try {
    const res = await fetch("/api/reviews/my-stall", {
      credentials: "include",
    });

    if (res.status === 401 || res.status === 403) {
      location.href = "signin.html";
      return;
    }

    if (res.status === 404) {
      setText("stallName", "No stall linked");
      setStatus("No stall is linked to this account.");
      allReviews = [];
      render();
      return;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    setText("stallName", data.stallName || "—");

    allReviews = (data.reviews || []).map(mapRow);
    latestMs = allReviews.length
      ? Math.max(...allReviews.map((r) => r.createdAtMs))
      : 0;

    // On this page = everything is seen; clear the dot for next visit.
    if (currentUserId && latestMs) {
      lastSeenMs = Math.max(lastSeenMs, latestMs);
      saveLastSeen(currentUserId, lastSeenMs);
    }

    setStatus("");
    render();
  } catch (err) {
    console.error("loadReviews error:", err);
    setStatus("❌ Failed to load reviews.");
    allReviews = [];
    render();
  }
}

/* ---------- session ---------- */
async function loadSession() {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) {
    location.href = "signin.html";
    return null;
  }
  return res.json();
}

/* ---------- events ---------- */
$("sortSelect")?.addEventListener("change", render);
$("photoOnly")?.addEventListener("change", render);

$("logoutBtn")?.addEventListener("click", async () => {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (e) {
    console.error("logout error:", e);
  }
  location.href = "signin.html";
});

/* click a review image to open it full size */
$("reviewsList")?.addEventListener("click", (e) => {
  const img = e.target.closest(".rvImg");
  if (!img) return;

  const overlay = document.createElement("div");
  overlay.className = "rvLightbox";
  overlay.innerHTML = `<img src="${img.src}" alt="Review image" />`;
  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
});

/* ---------- init ---------- */
(async function init() {
  // hide badges we don't populate on this page
  const a = $("analyticsBadge");
  if (a) a.style.display = "none";
  const h = $("hygieneBadge");
  if (h) h.style.display = "none";

  const user = await loadSession();
  if (!user) return;

  currentUserId = user.userId || user.UserId || user.id;
  setText("ownerName", user.name || user.Name || "User");
  lastSeenMs = loadLastSeen(currentUserId);

  await loadReviews();
})();
