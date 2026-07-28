// stall-notifications.js — bottom-right toast notifications for stall-holder pages.
//
// What it does:
//   • Reads the owner's saved notification preferences (the four toggles on the
//     Account page) once on load. A category only ever pops if its toggle is ON.
//   • Polls the backend every POLL_MS for genuinely new orders and reviews,
//     comparing against a per-user "last notified" timestamp in localStorage,
//     and fires a toast bottom-right for anything new.
//   • Exposes window.hpTestNotification() so a demo button can fire sample
//     toasts on cue, regardless of live activity.
//
// Include on every stall-holder page, e.g. before </body>:
//     <script src="js/stall-notifications.js"></script>
//
// Backend it uses (all already exist — no new endpoints required):
//   GET /api/stall/account                       -> notifPrefs + stall id
//   GET /api/reviews/my-stall/count?since=<iso>   -> { newCount }
//   GET /api/stall/orders                         -> { unpaidCash, paid, completed } (each order has createdAt)
//
// Note: /api/stall/orders is behind the rent paywall, so order popups pause
// while rent is overdue. That's intended — a locked stall can't take orders.

(function () {
  "use strict";

  const POLL_MS = 20000; // how often to check for new events
  const LS_PREFIX = "hp:notif:"; // localStorage namespace

  // ---- tiny helpers ---------------------------------------------------------

  function lsKey(uid, kind) {
    return `${LS_PREFIX}${kind}:${uid}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  async function apiGet(url) {
    const res = await fetch(url, { credentials: "include" });
    if (res.status === 401 || res.status === 403) throw new Error("unauth");
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  // ---- toast rendering ------------------------------------------------------

  function ensureStack() {
    let stack = document.getElementById("hpToastStack");
    if (stack) return stack;

    stack = document.createElement("div");
    stack.id = "hpToastStack";
    stack.setAttribute("aria-live", "polite");
    stack.style.cssText = [
      "position:fixed",
      "right:20px",
      "bottom:20px",
      "z-index:99999",
      "display:flex",
      "flex-direction:column",
      "gap:10px",
      "max-width:340px",
      "pointer-events:none",
    ].join(";");
    document.body.appendChild(stack);
    return stack;
  }

  // Per-category accent + icon, matching the four toggles.
  const KIND_STYLE = {
    order: {
      accent: "#E08A2B",
      bg: "#FFF6EA",
      icon: "🧾",
      title: "New order",
      link: "stall-orders.html",
    },
    orderUpdate: {
      accent: "#2B7DE0",
      bg: "#EEF5FF",
      icon: "🔔",
      title: "Order update",
      link: "stall-orders.html",
    },
    review: {
      accent: "#0F6E56",
      bg: "#E9F7F1",
      icon: "⭐",
      title: "New review",
      link: "stall-review.html",
    },
    hygiene: {
      accent: "#B4362F",
      bg: "#FDEDEC",
      icon: "🧼",
      title: "Hygiene inspection",
      link: "stall-hygiene.html",
    },
  };

  function showToast(kind, message) {
    const stack = ensureStack();
    const s = KIND_STYLE[kind] || KIND_STYLE.order;

    const toast = document.createElement("div");
    toast.setAttribute("role", "status");
    toast.style.cssText = [
      "pointer-events:auto",
      `background:${s.bg}`,
      `border-left:5px solid ${s.accent}`,
      "border-radius:12px",
      "box-shadow:0 8px 24px rgba(0,0,0,.16)",
      "padding:12px 14px",
      "display:flex",
      "gap:10px",
      "align-items:flex-start",
      "font-family:inherit",
      "opacity:0",
      "transform:translateY(8px)",
      "transition:opacity .22s ease, transform .22s ease",
      s.link ? "cursor:pointer" : "cursor:default",
    ].join(";");

    const iconEl = document.createElement("div");
    iconEl.textContent = s.icon;
    iconEl.style.cssText = "font-size:20px;line-height:1.2;flex:0 0 auto";

    const textWrap = document.createElement("div");
    textWrap.style.cssText = "flex:1 1 auto;min-width:0";

    const titleEl = document.createElement("div");
    titleEl.textContent = s.title;
    titleEl.style.cssText = `font-weight:900;color:${s.accent};font-size:14px`;

    const msgEl = document.createElement("div");
    msgEl.textContent = message;
    msgEl.style.cssText =
      "font-weight:700;color:rgba(0,0,0,.75);font-size:13px;margin-top:2px;word-wrap:break-word";

    textWrap.appendChild(titleEl);
    textWrap.appendChild(msgEl);

    // "View orders →" style affordance when there's a destination
    if (s.link) {
      const viewEl = document.createElement("div");
      viewEl.textContent = "View →";
      viewEl.style.cssText = `margin-top:6px;font-weight:900;font-size:12px;color:${s.accent};text-decoration:underline`;
      textWrap.appendChild(viewEl);
    }

    const closeEl = document.createElement("button");
    closeEl.setAttribute("aria-label", "Dismiss");
    closeEl.textContent = "✕";
    closeEl.style.cssText =
      "flex:0 0 auto;border:0;background:transparent;cursor:pointer;font-weight:900;color:rgba(0,0,0,.4);font-size:13px;padding:0 0 0 4px";

    toast.appendChild(iconEl);
    toast.appendChild(textWrap);
    toast.appendChild(closeEl);
    stack.appendChild(toast);

    // enter
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });

    let killed = false;
    const dismiss = () => {
      if (killed) return;
      killed = true;
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      setTimeout(() => toast.remove(), 240);
    };

    // ✕ dismisses without navigating
    closeEl.addEventListener("click", (e) => {
      e.stopPropagation();
      dismiss();
    });

    // Clicking the toast body navigates to the relevant page
    if (s.link) {
      toast.addEventListener("click", () => {
        location.href = s.link;
      });
    }

    // No auto-dismiss — stays until the owner clicks ✕ or opens the page.
  }

  // ---- polling logic --------------------------------------------------------

  let uid = null;
  let prefs = {
    newOrders: false,
    orderUpdates: false,
    newReview: false,
    hygiene: false,
  };

  // Get (or initialise) the "last seen" stamp for a category. On first run we
  // stamp "now" and return null, so we never dump the whole history as popups.
  function sinceStamp(kind) {
    const key = lsKey(uid, kind);
    const prev = localStorage.getItem(key);
    if (!prev) {
      localStorage.setItem(key, nowIso());
      return null; // first run — establish a baseline, no toast this tick
    }
    return prev;
  }

  // Reviews: the count endpoint already exists and takes ?since=<iso>.
  async function checkReviews() {
    if (!prefs.newReview || !uid) return;
    const since = sinceStamp("review");
    if (since === null) return;

    try {
      const { newCount } = await apiGet(
        `/api/reviews/my-stall/count?since=${encodeURIComponent(since)}`,
      );
      const n = Number(newCount) || 0;
      if (n > 0) {
        showToast(
          "review",
          n === 1 ? "You have 1 new review." : `You have ${n} new reviews.`,
        );
        localStorage.setItem(lsKey(uid, "review"), nowIso());
      }
    } catch (err) {
      /* unauth or transient — try again next tick */
    }
  }

  // Orders: no count endpoint, so pull the orders list and count client-side
  // by createdAt. Fetches /api/stall/orders (paywalled when rent is overdue).
  async function checkOrders() {
    if (!prefs.newOrders || !uid) return;
    const since = sinceStamp("order");
    if (since === null) return;

    try {
      const data = await apiGet("/api/stall/orders");
      const all = []
        .concat(data.unpaidCash || [])
        .concat(data.paid || [])
        .concat(data.completed || []);

      const sinceMs = new Date(since).getTime();
      const fresh = all.filter((o) => {
        const t = new Date(o.createdAt).getTime();
        return Number.isFinite(t) && t > sinceMs;
      });

      if (fresh.length > 0) {
        const n = fresh.length;
        showToast(
          "order",
          n === 1 ? "You have 1 new order." : `You have ${n} new orders.`,
        );
        // Advance to the newest order's timestamp so nothing is re-notified.
        const newest = Math.max(
          ...fresh.map((o) => new Date(o.createdAt).getTime()),
        );
        localStorage.setItem(
          lsKey(uid, "order"),
          new Date(newest).toISOString(),
        );
      }
    } catch (err) {
      /* 403 while paywalled, unauth, or transient — stay quiet */
    }
  }

  async function poll() {
    // Real detection: orders + reviews (the two with genuine event sources).
    await checkOrders();
    await checkReviews();
    // orderUpdate + hygiene have no real event source in the app, so they are
    // demo-only via the test button; polling them would be fake wiring.
  }

  // ---- demo hook ------------------------------------------------------------
  // Fires one sample toast per ENABLED category. Wire a button to this for the
  // demo video, e.g. <button onclick="hpTestNotification()">Test notifications</button>
  window.hpTestNotification = function () {
    const samples = [
      ["order", prefs.newOrders, "Order #1042 — 2 items, $8.40 (PayNow)."],
      [
        "orderUpdate",
        prefs.orderUpdates,
        "Order #1039 marked ready for collection.",
      ],
      ["review", prefs.newReview, "New 5★ review: “Best laksa in the west!”"],
      ["hygiene", prefs.hygiene, "NEA inspection scheduled for next Tuesday."],
    ];
    let shown = 0;
    samples.forEach(([kind, on, msg], i) => {
      if (!on) return;
      setTimeout(() => showToast(kind, msg), i * 350); // stagger for effect
      shown++;
    });
    if (shown === 0) {
      showToast("order", "All notification types are switched off in Account.");
    }
  };

  // ---- boot -----------------------------------------------------------------

  async function boot() {
    try {
      const acct = await apiGet("/api/stall/account");
      uid = acct?.profile?.userId || null;
      if (acct?.notifPrefs) prefs = acct.notifPrefs;
    } catch (err) {
      return; // not signed in on this page; do nothing
    }
    if (!uid) return;

    poll(); // first pass
    setInterval(poll, POLL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
