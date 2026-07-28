/* This is the "View All Feedback" page, Not the Feedback Dashboard */
 

let currentUser = null;
let allReviews = [];
let searchDebounceTimer = null;

const listEl = document.getElementById("gfList");
const statusEl = document.getElementById("gfStatus");
const emptyEl = document.getElementById("gfEmpty");
const searchInput = document.getElementById("gfSearchInput");
const ratingFilter = document.getElementById("gfRatingFilter");

function esc(s = "") {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
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
    return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}


async function loadReviews() {
  statusEl.textContent = "Loading feedback...";
  statusEl.style.display = "block";
  emptyEl.hidden = true;
  listEl.innerHTML = "";

  const stallName = searchInput.value.trim();
  const rating = ratingFilter.value;

  const params = new URLSearchParams();
  if (stallName) params.set("stallName", stallName);
  if (rating) params.set("rating", rating);

  try {
    const res = await fetch(`/api/reviews/search?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to load feedback");
    allReviews = await res.json();
    renderReviews();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Couldn't load feedback right now.";
  }
}

function renderReviews() {
  statusEl.style.display = "none";
  listEl.innerHTML = "";

  if (!allReviews.length) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  for (const r of allReviews) {
    const card = document.createElement("article");
    card.className = "gfCard";
    card.dataset.reviewId = r.ReviewId;

    const isOwnReview = currentUser && r.UserId === currentUser.id;
    const userLabel = r.IsAnonymous ? "Anonymous" : r.UserName || "Anonymous";

    card.innerHTML = `
      <div class="gfCardTop">
        <div class="gfStallName">${esc(r.StallName || r.StallId || "Unknown stall")}</div>
        <div class="gfRating">
          <span class="fbStars">${renderStars(r.Rating)}</span>
          <span class="fbRatingNum">${Number(r.Rating || 0).toFixed(1)}</span>
        </div>
      </div>

      ${r.ImageUrl ? `<img src="${esc(r.ImageUrl)}" alt="Review image" class="gfReviewImg" loading="lazy" />` : ""}

      <p class="gfText">${esc(r.ReviewText || "")}</p>

      <div class="gfMeta">
        <span>${esc(userLabel)}</span>
        <span class="gfDot">•</span>
        <span>${esc(fmtDate(r.CreatedAt))}</span>

        ${
          currentUser && !isOwnReview
            ? `<a class="gfReportLink" href="report.html?reviewId=${encodeURIComponent(r.ReviewId)}">Report</a>`
            : ""
        }
      </div>

      <button type="button" class="gfCommentsToggle" onclick="toggleComments('${r.ReviewId}')">
        💬 <span id="commentCount-${r.ReviewId}">Comments</span>
      </button>

      <div class="gfComments" id="comments-${r.ReviewId}" hidden>
        <div class="gfCommentList" id="commentList-${r.ReviewId}">
          <p class="gfCommentLoading">Loading comments...</p>
        </div>

        ${
          currentUser
            ? `
          <form class="gfCommentForm" onsubmit="return submitComment(event, '${r.ReviewId}')">
            <input class="std-input gfCommentInput" type="text" placeholder="Add a comment..." maxlength="1000" />
            <button type="submit" class="gfCommentBtn">Post</button>
          </form>
        `
            : `<p class="gfCommentLoginHint"><a href="signin.html">Log in</a> to comment.</p>`
        }
      </div>
    `;

    listEl.appendChild(card);
    loadComments(r.ReviewId);
  }
}


window.toggleComments = (reviewId) => {
  const el = document.getElementById(`comments-${reviewId}`);
  if (!el) return;
  el.hidden = !el.hidden;
};

async function loadComments(reviewId) {
  const container = document.getElementById(`commentList-${reviewId}`);
  if (!container) return;

  try {
    const res = await fetch(`/api/comments/${reviewId}`);
    if (!res.ok) throw new Error("Failed to load comments");
    const comments = await res.json();
    renderComments(reviewId, comments);

    const countEl = document.getElementById(`commentCount-${reviewId}`);
    if (countEl) countEl.textContent = comments.length ? `Comments (${comments.length})` : "Comments";
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="gfCommentEmpty">Couldn't load comments.</p>`;
  }
}

function renderComments(reviewId, comments) {
  const container = document.getElementById(`commentList-${reviewId}`);
  if (!container) return;

  if (!comments.length) {
    container.innerHTML = `<p class="gfCommentEmpty">No comments yet.</p>`;
    return;
  }

  container.innerHTML = comments
    .map(
      (c) => `
    <div class="gfCommentItem">
      <span class="gfCommentAuthor">${esc(c.UserName)}</span>
      <span class="gfCommentText">${esc(c.CommentText)}</span>
      <span class="gfCommentDate">${esc(fmtDate(c.CreatedAt))}</span>
    </div>
  `,
    )
    .join("");
}

window.submitComment = async (event, reviewId) => {
  event.preventDefault();

  const form = event.target;
  const input = form.querySelector(".gfCommentInput");
  const text = input.value.trim();

  if (!text) {
    input.focus();
    return false;
  }

  const btn = form.querySelector(".gfCommentBtn");
  btn.disabled = true;

  try {
    const res = await AuthClient.apiFetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, commentText: text }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to post comment.");
    }

    input.value = "";
    await loadComments(reviewId); // real-time-feeling refresh, no page reload
  } catch (err) {
    console.error(err);
    alert(err.message || "Failed to post comment.");
  } finally {
    btn.disabled = false;
  }

  return false;
};


searchInput?.addEventListener("input", () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(loadReviews, 300);
});

ratingFilter?.addEventListener("change", loadReviews);


(async function init() {
  if (searchInput) searchInput.value = "";
  if (ratingFilter) ratingFilter.value = "";
  currentUser = await AuthClient.getCurrentUser(); 
  await loadReviews();
})();