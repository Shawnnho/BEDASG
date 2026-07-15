// stall-badges.js — populates sidebar badge counts on stall-holder pages.
// Load on every stall-* page EXCEPT stall-review.html (that page clears its own badge).

(function () {
  const setBadge = (id, n) => {
    const el = document.getElementById(id);
    if (!el) return;
    const count = Number(n) || 0;
    if (count > 0) {
      el.textContent = String(count);
      el.style.display = "grid";
    } else {
      el.textContent = "";
      el.style.display = "none";
    }
  };

  // Unpaid cash orders needing the owner's attention
  async function loadOrderBadge() {
    try {
      const res = await fetch("/api/stall/dashboard", {
        credentials: "include",
      });
      if (!res.ok) return;

      const data = await res.json();
      setBadge("orderBadge", data.stats?.unpaidCash);
    } catch (err) {
      console.error("order badge failed:", err);
    }
  }

  // Reviews left since the owner last opened the Review page.
  // stall-review.js writes that timestamp to localStorage when it loads.
  async function loadReviewBadge() {
    try {
      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      if (!meRes.ok) return;

      const payload = await meRes.json();

      // /api/auth/me returns { user: { id, name, email, phone, role } }
      const user = payload.user || payload;
      const uid = user.id || user.userId || user.UserId;
      if (!uid) return;

      const lastSeenMs = Number(
        localStorage.getItem(`hp:lastSeenReviewMs:${uid}`),
      );

      // Never opened the Review page? Show the total count instead.
      const since =
        Number.isFinite(lastSeenMs) && lastSeenMs > 0
          ? new Date(lastSeenMs).toISOString()
          : "";

      const url = since
        ? `/api/reviews/my-stall/count?since=${encodeURIComponent(since)}`
        : "/api/reviews/my-stall/count";

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return;

      const data = await res.json();
      setBadge("reviewBadge", data.newCount);
    } catch (err) {
      console.error("review badge failed:", err);
    }
  }

  loadOrderBadge();
  loadReviewBadge();
})();
