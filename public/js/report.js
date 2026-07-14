
const params = new URLSearchParams(window.location.search);
const reviewId = params.get("reviewId");

let currentUser = null;

function esc(s = "") {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function renderStars(rating = 0) {
  const r = Math.max(0, Math.min(5, Number(rating)));
  const full = Math.floor(r);
  let html = "";
  for (let i = 0; i < full; i++) html += "★";
  for (let i = full; i < 5; i++) html += "☆";
  return html;
}

async function loadReviewPreview() {
  const container = document.getElementById("reportReviewPreview");

  if (!reviewId) {
    container.innerHTML = `<p>No review specified.</p>`;
    return;
  }

  try {
    const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}`);
    if (!res.ok) throw new Error("Review not found.");
    const review = await res.json();

    container.innerHTML = `
      <div class="reportReviewCard">
        <div class="reportReviewTop">
          <strong>${esc(review.StallName || review.StallId || "Unknown stall")}</strong>
          <span class="reportReviewStars">${renderStars(review.Rating)}</span>
        </div>
        <p class="reportReviewText">${esc(review.ReviewText || "")}</p>
        <p class="reportReviewAuthor">— ${esc(review.IsAnonymous ? "Anonymous" : review.UserName || "Anonymous")}</p>
      </div>
    `;
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p>Couldn't load this review.</p>`;
  }
}

function setSubmitState(state) {
  const btn = document.getElementById("reportSubmitBtn");
  if (!btn) return;

  if (state === "loading") {
    btn.disabled = true;
    btn.textContent = "Submitting...";
    return;
  }
  if (state === "success") {
    btn.disabled = true;
    btn.textContent = "Submitted";
    return;
  }
  btn.disabled = false;
  btn.textContent = "Submit Report";
}

window.submitReport = async function () {
  const reasonEl = document.getElementById("reportReason");
  const detailsEl = document.getElementById("reportDetails");
  const errorEl = document.getElementById("reportError");
  const successEl = document.getElementById("reportSuccess");

  errorEl.style.display = "none";
  successEl.style.display = "none";

  if (!reviewId) {
    errorEl.textContent = "No review specified.";
    errorEl.style.display = "block";
    return;
  }

  if (!reasonEl.value) {
    errorEl.textContent = "Please select a reason.";
    errorEl.style.display = "block";
    return;
  }

  setSubmitState("loading");

  try {
    const res = await AuthClient.apiFetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewId,
        reason: reasonEl.value,
        details: detailsEl.value.trim(),
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to submit report.");
    }

    successEl.style.display = "block";
    setSubmitState("success");
  } catch (err) {
    console.error(err);
    errorEl.textContent = err.message || "Failed to submit report.";
    errorEl.style.display = "block";
    setSubmitState("idle");
  }
};

(async function init() {
  currentUser = await AuthClient.getCurrentUser();

  if (!currentUser) {
    alert("Please log in to report a review.");
    window.location.href = "signin.html";
    return;
  }

  await loadReviewPreview();
})();