/*
  feedback_history.js — uses AuthClient (cookie-based auth) instead of
  localStorage/JWT decoding. Requires authClient.js loaded BEFORE this
  script on feedback_history.html:
    <script src="authClient.js"></script>
    <script src="feedback_history.js"></script>

  Same element ids as your original feedback_history.html, so no other
  HTML changes needed.
*/

const listEl = document.getElementById("historyList");
const statusEl = document.getElementById("historyStatus");
const emptyEl = document.getElementById("historyEmpty");

const tabsWrap = document.querySelector(".historyTabs");
let activeTab = "all";

const sortEl = document.getElementById("historySort");
let activeSort = "relevant"; // relevant | newest | starsDesc | starsAsc

function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString();
}

function escapeHtml(s) {
  return (s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );
}

function avatarHtml(userMeta) {
  const name = userMeta?.name || "You";
  const initial = escapeHtml((name.trim()[0] || "Y").toUpperCase());
  const photo = userMeta?.photoURL ? escapeHtml(userMeta.photoURL) : "";

  if (photo) {
    return `<img class="historyAvatarImg" src="${photo}" alt="Profile picture" />`;
  }
  return `<div class="historyAvatarFallback" aria-hidden="true">${initial}</div>`;
}

function cardHtml(item, userMeta) {
  const badge =
    item.type === "review"
      ? `<span class="badge badgeReview">Review</span>`
      : `<span class="badge badgeComplaint">Complaint</span>`;

  let title;

  if (item.type === "review") {
    const r = Math.max(0, Math.min(5, Number(item.rating || 0)));
    const full = Math.floor(r);
    const half = r - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;

    const starsHtml =
      `<span class="ratingWrap">` +
      `<span class="ratingFull">${"★".repeat(full)}</span>` +
      (half ? `<span class="ratingHalf">★</span>` : ``) +
      `<span class="ratingEmpty">${"★".repeat(empty)}</span>` +
      `</span>`;

    title = `${escapeHtml(item.stallName || "Stall")} • ${starsHtml}`;
  } else {
    title = `${escapeHtml(item.stallName || "Stall")} • Complaint`;
  }

  const tags =
    item.type === "review" && item.tags?.length
      ? `<div class="tagLine">${item.tags
          .map((t) => `<span class="miniTag">${escapeHtml(t)}</span>`)
          .join("")}</div>`
      : "";

  const img = item.imageUrl
    ? `<img class="historyImg" src="${escapeHtml(item.imageUrl)}" alt="Attachment" />`
    : "";

  const body = item.type === "review" ? escapeHtml(item.text || "") : escapeHtml(item.message || "");

  return `
    <div class="historyCard" data-type="${item.type}">
      <div class="historyTop">
        <div class="historyLeft">
          <div class="historyAvatar">
            ${avatarHtml(userMeta)}
          </div>

          <div class="historyTitle">
            ${badge} <span>${title}</span>
          </div>
        </div>

        <div class="historyDate">${escapeHtml(fmtDate(item.createdAt))}</div>
      </div>

      ${tags}

      <div class="historyBody">${body}</div>
      ${img}
    </div>
  `;
}

function sortItems(arr) {
  return [...arr].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime() || 0;
    const tb = new Date(b.createdAt).getTime() || 0;

    const ra = Number(a.rating ?? 0);
    const rb = Number(b.rating ?? 0);

    const hasImgA = a.imageUrl ? 1 : 0;
    const hasImgB = b.imageUrl ? 1 : 0;

    const textA = (a.type === "review" ? a.text || "" : a.message || "").trim();
    const textB = (b.type === "review" ? b.text || "" : b.message || "").trim();

    const lenA = textA.length;
    const lenB = textB.length;

    if (activeSort === "newest") return tb - ta;

    if (activeSort === "starsDesc") {
      if (rb !== ra) return rb - ra;
      return tb - ta;
    }

    if (activeSort === "starsAsc") {
      if (ra !== rb) return ra - rb;
      return tb - ta;
    }

    // Most relevant (approx Google-style)
    const isReviewA = a.type === "review" ? 1 : 0;
    const isReviewB = b.type === "review" ? 1 : 0;
    if (isReviewB !== isReviewA) return isReviewB - isReviewA;

    if (rb !== ra) return rb - ra;
    if (hasImgB !== hasImgA) return hasImgB - hasImgA;
    if (lenB !== lenA) return lenB - lenA;

    return tb - ta;
  });
}

function render(items, userMeta) {
  const filtered = activeTab === "all" ? items : items.filter((x) => x.type === activeTab.slice(0, -1));
  const sorted = sortItems(filtered);

  listEl.innerHTML = sorted.map((it) => cardHtml(it, userMeta)).join("");

  const hasAny = sorted.length > 0;
  statusEl.style.display = "none";
  emptyEl.style.display = hasAny ? "none" : "block";
}

// Normalise the two SQL response shapes into the same `item` shape
// cardHtml()/sortItems() expect, matching your original Firestore fields.
function mapComplaint(c) {
  return {
    id: c.ComplaintId,
    type: "complaint",
    stallName: c.StallName,
    message: c.Message,
    imageUrl: c.ImageUrl,
    createdAt: c.CreatedAt,
  };
}

function mapReview(r) {
  let tags = [];
  try {
    tags = r.TagsJson ? JSON.parse(r.TagsJson) : [];
  } catch {
    tags = [];
  }

  return {
    id: r.ReviewId,
    type: "review",
    stallName: r.StallName,
    rating: r.Rating,
    text: r.ReviewText,
    tags,
    imageUrl: r.ImageUrl,
    createdAt: r.CreatedAt,
  };
}

async function loadHistory(user) {
  statusEl.textContent = "Loading…";
  statusEl.style.display = "block";
  emptyEl.style.display = "none";
  listEl.innerHTML = "";

  const userMeta = { name: user.name || user.email || "You", photoURL: "" };

  const [complaintsRes, reviewsRes] = await Promise.all([
    AuthClient.apiFetch("/api/complaints/mine"),
    AuthClient.apiFetch("/api/reviews/mine"),
  ]);

  if (!complaintsRes.ok || !reviewsRes.ok) {
    throw new Error("Failed to load history.");
  }

  const complaints = (await complaintsRes.json()).map(mapComplaint);
  const reviews = (await reviewsRes.json()).map(mapReview);

  const all = [...complaints, ...reviews].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime() || 0;
    const tb = new Date(b.createdAt).getTime() || 0;
    return tb - ta;
  });

  render(all, userMeta);

  sortEl?.addEventListener("change", () => {
    activeSort = sortEl.value;
    render(all, userMeta);
  });

  tabsWrap?.addEventListener("click", (e) => {
    const btn = e.target.closest(".tabBtn");
    if (!btn) return;

    document.querySelectorAll(".tabBtn").forEach((b) => b.classList.remove("isOn"));
    btn.classList.add("isOn");
    activeTab = btn.dataset.tab;

    render(all, userMeta);
  });
}

(async function init() {
  const user = await AuthClient.getCurrentUser();

  if (!user) {
    statusEl.textContent = "Please log in to view your feedback history.";
    return;
  }

  try {
    await loadHistory(user);
  } catch (err) {
    console.error(err);
    statusEl.textContent = err?.message || "Failed to load history.";
  }
})();

/* ================= Image Click → Full Preview ================= */

const imgModal = document.getElementById("imgModal");
const imgModalBackdrop = document.getElementById("imgModalBackdrop");
const imgModalContent = document.getElementById("imgModalContent");

document.addEventListener("click", (e) => {
  const img = e.target.closest(".historyImg");
  if (!img) return;
  imgModalContent.src = img.src;
  imgModal.hidden = false;
});

imgModalBackdrop?.addEventListener("click", closeImgModal);
imgModalContent?.addEventListener("click", closeImgModal);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeImgModal();
});

function closeImgModal() {
  imgModal.hidden = true;
  imgModalContent.src = "";
}