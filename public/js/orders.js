async function checkLogin() {
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      return { uid: data.user.id };
    }
    return null;
  } catch {
    return null;
  }
}

function money(n) {
  return (Number(n) || 0).toFixed(2);
}

function prettyPayMethod(m) {
  const x = String(m || "").toLowerCase();
  if (x.includes("cash")) return "Cash";
  if (x.includes("paynow") || x.includes("nets") || x === "qr") return "PayNow / NETS QR";
  if (x.includes("card") || x.includes("credit") || x.includes("debit")) return "Card";
  return m || "—";
}

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function makeDisplayId(prefix, id) {
  const short = String(id || "").slice(-6).toUpperCase();
  return `#${prefix}${short}`;
}

async function loadOrdersForOwner(checkoutIdFilter) {
  const qs = checkoutIdFilter ? `?checkoutId=${encodeURIComponent(checkoutIdFilter)}` : "";
  const res = await fetch(`/api/orders${qs}`);
  if (!res.ok) throw new Error("Failed to load orders");
  const data = await res.json();
  return Array.isArray(data.orders) ? data.orders : [];
}

function normPayKey(m) {
  const x = String(m || "").toLowerCase();
  if (x.includes("cash")) return "cash";
  if (x.includes("paynow") || x.includes("nets") || x === "qr") return "qr";
  if (x.includes("card")) return "card";
  return "other";
}

function isCompletedStatus(status) {
  const s = String(status || "").toLowerCase();
  return s === "completed" || s === "collected" || s === "done";
}

function isPendingStatus(status) {
  return !isCompletedStatus(status);
}

function statusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "completed" || s === "collected" || s === "done") return "stDone";
  if (s.includes("pending_payment") || s.includes("pending")) return "stPay";
  if (s.includes("paid") || s.includes("processing")) return "stPaid";
  if (s.includes("preparing")) return "stPrep";
  if (s.includes("ready")) return "stReady";
  return "stDefault";
}

function wireTabs() {
  const tabBtns = document.querySelectorAll(".ordersTab[data-tab]");
  const wrapPending = document.getElementById("ordersPendingWrap");
  const wrapCompleted = document.getElementById("ordersCompletedWrap");

  if (!tabBtns.length || !wrapPending || !wrapCompleted) return;

  function setTab(name) {
    tabBtns.forEach((b) => b.classList.toggle("isActive", b.dataset.tab === name));
    wrapPending.hidden = name !== "pending";
    wrapCompleted.hidden = name !== "completed";
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });

  setTab("pending");
}

// Merge sibling orders that share a CheckoutId (multi-stall checkout) into
// a single display entry: combined total, combined items, combined stall
// names, and the least-advanced status among them.
function combineOrdersByCheckout(orders) {
  const groups = new Map();
  for (const o of orders) {
    const key = o.checkoutId || o.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  }

  const STATUS_PRIORITY = [
    "pending_payment",
    "pending",
    "paid",
    "processing",
    "preparing",
    "ready",
    "completed",
    "collected",
    "done",
  ];

  function leastAdvancedStatus(list) {
    let best = list[0]?.status ?? null;
    let bestRank = Infinity;
    for (const o of list) {
      const s = String(o.status || "").toLowerCase();
      const rank = STATUS_PRIORITY.indexOf(s);
      const effectiveRank = rank === -1 ? STATUS_PRIORITY.length : rank;
      if (effectiveRank < bestRank) {
        bestRank = effectiveRank;
        best = o.status;
      }
    }
    return best;
  }

  const merged = [];
  for (const list of groups.values()) {
    if (list.length === 1) {
      merged.push(list[0]);
      continue;
    }

    const stallNames = Array.from(new Set(list.map((o) => o.stallName).filter(Boolean)));
    const orderNos = list.map((o) => o.orderNo).filter(Boolean);
    const allItems = list.flatMap((o) => o.items || []);
    const total = list.reduce((s, o) => s + Number(o.pricing?.total || 0), 0);
    const allCompleted = list.every((o) => isCompletedStatus(o.status));

    merged.push({
      id: list[0].id,
      orderNo: orderNos.join(", "),
      stallName: stallNames.join(", "),
      status: allCompleted ? "completed" : leastAdvancedStatus(list),
      checkoutId: list[0].checkoutId,
      payment: list[0].payment,
      pricing: { total },
      fulfillment: list[0].fulfillment,
      createdAt: list[0].createdAt,
      items: allItems,
    });
  }

  return merged;
}

window.reorderOrder = async function (orderId) {
  try {
    const orders = window.__ALL_ORDERS || [];
    const order = orders.find((o) => String(o.id) === String(orderId));

    if (!order) {
      alert("Could not find that order.");
      return;
    }

    const items = order.items || [];
    if (!items.length) {
      alert("This order has no items to reorder.");
      return;
    }

    const user = await checkLogin();
    const CART_KEY = "hp_cart"; // must match cart.js's CART_KEY

    if (!user) {
      let cart = [];
      try {
        cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
        if (!Array.isArray(cart)) cart = [];
      } catch {
        cart = [];
      }
      localStorage.setItem(CART_KEY, JSON.stringify(cart.concat(items)));
    } else {
      const existingRes = await fetch(`/api/cart/${user.uid}`);
      let existing = [];
      if (existingRes.ok) {
        existing = await existingRes.json();
        if (!Array.isArray(existing)) existing = [];
      }

      await fetch(`/api/cart/${user.uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: existing.concat(items) }),
      });
    }

    window.location.href = "cart.html";
  } catch (err) {
    console.error(err);
    alert("Could not reorder. Please try again.");
  }
};

function renderOrders(orders, checkoutIdFilter) {
  const bannerEl = document.getElementById("ordersBanner");

  const pendingList = document.getElementById("ordersPendingList");
  const completedList = document.getElementById("ordersCompletedList");
  const pendingEmpty = document.getElementById("ordersPendingEmpty");
  const completedEmpty = document.getElementById("ordersCompletedEmpty");

  const searchEl = document.getElementById("ordersSearch");
  const statusEl = document.getElementById("ordersStatusFilter");
  const payEl = document.getElementById("ordersPayFilter");

  if (!pendingList || !completedList) return;

  if (bannerEl) {
    if (checkoutIdFilter) {
      bannerEl.hidden = false;
      bannerEl.textContent = `Showing orders from your latest payment (Checkout: ${checkoutIdFilter})`;
    } else {
      bannerEl.hidden = true;
    }
  }

  const q = (searchEl?.value || "").trim().toLowerCase();
  const statusFilter = statusEl?.value || "all";
  const payFilter = payEl?.value || "all";

  let filtered = orders.slice();

  if (q) {
    filtered = filtered.filter((o) => {
      const id = String(o.orderNo || o.id || "").toLowerCase();
      const stallName = String(o.stallName || "Unknown Stall").toLowerCase();
      return id.includes(q) || stallName.includes(q);
    });
  }

  if (payFilter !== "all") {
    filtered = filtered.filter((o) => normPayKey(o.payment?.method) === payFilter);
  }

  let pending = filtered.filter((o) => isPendingStatus(o.status));
  let completed = filtered.filter((o) => isCompletedStatus(o.status));

  if (statusFilter === "pending") completed = [];
  if (statusFilter === "completed") pending = [];

  const ts = (x) => {
    const d = new Date(x?.createdAt);
    return Number.isFinite(d.getTime()) ? d.getTime() : 0;
  };
  pending.sort((a, b) => ts(b) - ts(a));
  completed.sort((a, b) => ts(b) - ts(a));

  const pendingCountEl = document.getElementById("pendingCount");
  const completedCountEl = document.getElementById("completedCount");
  if (pendingCountEl) pendingCountEl.textContent = String(pending.length);
  if (completedCountEl) completedCountEl.textContent = String(completed.length);

  function cardHtml(o) {
    const stallName = String(o.stallName || "").trim() || "Unknown Stall";
    const paymentType = prettyPayMethod(o.payment?.method);
    const total = o.pricing?.total ?? 0;
    const fulfill = o.fulfillment?.type === "delivery" ? "Delivery" : "Pickup";
    const displayId = o.orderNo || makeDisplayId("OD", o.id);

    const href = o.checkoutId
      ? `payment_recieved.html?checkoutId=${encodeURIComponent(o.checkoutId)}`
      : `payment_recieved.html?orderId=${encodeURIComponent(o.id)}`;

    const statusText = String(o.status || "").replaceAll("_", " ");

    return `
      <div class="orderCard">
        <div class="orderLeft">
          <div class="orderTopRow">
            <div class="orderIdRow">Order: ${displayId}</div>
            <span class="orderStatusPill ${statusClass(o.status)}">${statusText || "pending"}</span>
          </div>

          <div class="orderMainTitle">${stallName}</div>

          <div class="orderMetaRow">
            <span class="chip">${fulfill}</span>
            <span class="chip">${paymentType}</span>
            <span class="chip strong">$${money(total)}</span>
          </div>
        </div>

        <div class="orderActions">
          <button type="button" class="orderBtn" onclick="reorderOrder('${o.id}')">Reorder</button>
          <a class="orderBtn" href="${href}">View</a>
        </div>
      </div>
    `;
  }

  pendingList.innerHTML = pending.map(cardHtml).join("");
  completedList.innerHTML = completed.map(cardHtml).join("");

  pendingEmpty.hidden = pending.length !== 0;
  completedEmpty.hidden = completed.length !== 0;
}

function wireFilters(latestOrdersRef) {
  const ids = ["ordersSearch", "ordersStatusFilter", "ordersPayFilter"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => renderOrders(latestOrdersRef.orders, latestOrdersRef.checkoutId));
    el.addEventListener("change", () => renderOrders(latestOrdersRef.orders, latestOrdersRef.checkoutId));
  });
}

(async () => {
  const user = await checkLogin();
  if (!user) {
    window.location.href = "account.html";
    return;
  }

  const checkoutIdFilter = getQueryParam("checkoutId");

  try {
    const orders = await loadOrdersForOwner(checkoutIdFilter);
    const merged = combineOrdersByCheckout(orders);
    window.__ALL_ORDERS = merged;
    const state = { orders: merged, checkoutId: checkoutIdFilter };
    wireFilters(state);
    wireTabs();
    renderOrders(state.orders, state.checkoutId);
  } catch (err) {
    console.error(err);
    window.__ALL_ORDERS = [];
    const state = { orders: [], checkoutId: checkoutIdFilter };
    wireFilters(state);
    wireTabs();
    renderOrders(state.orders, state.checkoutId);
  }
})();