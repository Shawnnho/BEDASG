// stall-dashboard.js — MSSQL/Express version (no Firebase), cookie auth
// Polls /api/stall/dashboard every few seconds and renders orders + stats.

let latestStats = {};

const API_BASE = ""; // same origin
const POLL_MS = 5000;

/* ===== helpers ===== */
const $ = (id) => document.getElementById(id);

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? "—";
}

function setBadge(id, value) {
  const el = $(id);
  if (!el) return;
  const n = Number(value) || 0;
  if (n > 0) {
    el.textContent = String(n);
    el.style.display = "grid";
  } else {
    el.textContent = "";
    el.style.display = "none";
    el.classList.remove("isNew");
  }
}

function money(n) {
  const x = Number(n);
  return Number.isFinite(x) ? `$${x.toFixed(2)}` : "$0.00";
}

function prettyStatus(s) {
  if (s === "pending") return "Pending";
  if (s === "in-progress") return "In Progress";
  if (s === "completed") return "Completed";
  if (s === "cancelled") return "Cancelled";
  return s || "—";
}

function escapeHtml(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

function showToast(msg) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

/* ===== UI state ===== */
let activeStatus = "";
let activeDate = "";
let activeYear = "";
let allOrders = [];
let firstLoadDone = false;

/* ===== date filtering ===== */
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function inDateRange(createdAt, mode) {
  if (!mode || mode === "all") return true;
  if (!createdAt) return false;

  const d = new Date(createdAt);
  if (!Number.isFinite(d.getTime())) return false;

  const now = new Date();
  const today0 = startOfToday();
  const msDay = 24 * 60 * 60 * 1000;

  if (mode === "today") return d >= today0;
  if (mode === "yesterday") {
    const y0 = new Date(today0.getTime() - msDay);
    return d >= y0 && d < today0;
  }
  if (mode === "last7") return d >= new Date(now.getTime() - 7 * msDay);
  if (mode === "thisMonth")
    return d >= new Date(now.getFullYear(), now.getMonth(), 1);
  if (mode === "lastMonth") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 1);
    return d >= from && d < to;
  }
  return true;
}

function rebuildFilterOptions() {
  const years = new Set();
  for (const o of allOrders) {
    const d = o.createdAt ? new Date(o.createdAt) : null;
    if (d && Number.isFinite(d.getTime())) years.add(String(d.getFullYear()));
  }

  const dateSel = $("dateFilter");
  if (dateSel && dateSel.options.length <= 1) {
    dateSel.innerHTML = `
      <option value="">Date</option>
      <option value="today">Today</option>
      <option value="yesterday">Yesterday</option>
      <option value="last7">Last 7 days</option>
      <option value="thisMonth">This month</option>
      <option value="lastMonth">Last month</option>
      <option value="all">All time</option>`;
    if (activeDate) dateSel.value = activeDate;
  }

  const yearSel = $("yearFilter");
  if (yearSel) {
    const sorted = Array.from(years).sort((a, b) => Number(b) - Number(a));
    yearSel.innerHTML =
      `<option value="">Year</option>` +
      sorted.map((y) => `<option value="${y}">${y}</option>`).join("");
    if (activeYear) yearSel.value = activeYear;
  }
}

/* ===== render ===== */
function renderOrdersTable() {
  const qtxt = ($("searchInput")?.value || "").trim().toLowerCase();

  const filtered = allOrders
    .filter((o) => !activeStatus || o.status === activeStatus)
    .filter((o) => {
      if (!activeYear) return true;
      const d = o.createdAt ? new Date(o.createdAt) : null;
      return d && String(d.getFullYear()) === String(activeYear);
    })
    .filter((o) => inDateRange(o.createdAt, activeDate))
    .filter((o) => {
      if (!qtxt) return true;
      const idText = String(o.orderNo || o.orderId || "").toLowerCase();
      const custText = String(o.customer || "").toLowerCase();
      return idText.includes(qtxt) || custText.includes(qtxt);
    });

  // stats from ALL orders (not filtered)
  const pending = allOrders.filter((o) => o.status === "pending").length;
  const inProgress = allOrders.filter((o) => o.status === "in-progress").length;
  const cancelled = allOrders.filter((o) => o.status === "cancelled").length;
  const sales = allOrders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  setText("statPendingNum", pending);
  setText("statProgressNum", inProgress);
  setText("statCancelledNum", cancelled);
  setText("statSalesNum", money(sales));
  setBadge("orderBadge", latestStats.unpaidCash || 0);

  const body = $("ordersBody");
  if (!body) return;

  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="7" style="padding:14px;">🍜 No orders yet. Waiting for customers…</td></tr>`;
    return;
  }

  body.innerHTML = filtered
    .map((o) => {
      const displayId = escapeHtml(
        o.orderNo || `#${String(o.orderId).slice(-6).toUpperCase()}`,
      );
      // Cancel only makes sense before payment — no refund path exists
      const cancelBtn =
        o.status === "pending"
          ? `<button class="rowBtn rowBtnCancel" type="button" data-cancel="${escapeHtml(o.orderId)}">Cancel</button>`
          : "";

      return `
      <tr>
        <td><input type="checkbox" class="orderCheck" data-oid="${escapeHtml(o.orderId)}" /></td>
        <td>${displayId}</td>
        <td>${escapeHtml(o.customer)}</td>
        <td><span class="prep ${prettyStatus(o.status)}">${prettyStatus(o.status)}</span></td>
        <td>${escapeHtml(o.item)}</td>
        <td>${money(o.amount)}</td>
        <td>
          <div class="rowActions">
            <button class="rowBtn rowBtnView" type="button" data-view="${escapeHtml(o.orderId)}">View</button>
            ${cancelBtn}
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

/* ===== data fetch (polling) ===== */
async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/api/stall/dashboard`, {
      credentials: "include",
    });

    if (res.status === 401 || res.status === 403) {
      location.href = "signin.html";
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    setText("stallName", data.stallName || "—");
    setText("ownerName", data.ownerName || "Owner");

    const prevIds = new Set(allOrders.map((o) => o.orderId));
    allOrders = Array.isArray(data.orders) ? data.orders : [];
    latestStats = data.stats || {};

    if (firstLoadDone) {
      const newOnes = allOrders.filter((o) => !prevIds.has(o.orderId));
      if (newOnes.length) {
        showToast(
          `🆕 ${newOnes.length} new order${newOnes.length > 1 ? "s" : ""}`,
        );
      }
    }
    firstLoadDone = true;

    rebuildFilterOptions();
    renderOrdersTable();
  } catch (err) {
    console.error("loadDashboard error:", err);
    if (!firstLoadDone) {
      const body = $("ordersBody");
      if (body) {
        body.innerHTML = `<tr><td colspan="7" style="padding:14px;">Failed to load orders.</td></tr>`;
      }
    }
  }
}

/* ===== bulk status update ===== */
async function bulkUpdateStatus(newStatus) {
  const checks = Array.from(document.querySelectorAll(".orderCheck:checked"));
  if (checks.length === 0) {
    alert("Select at least 1 order first.");
    return;
  }
  if (!newStatus) {
    alert("Choose a status in Bulk Action.");
    return;
  }

  const orderIds = checks.map((cb) => cb.dataset.oid).filter(Boolean);

  const res = await fetch(`${API_BASE}/api/stall/orders/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ orderIds, status: newStatus }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const { updated } = await res.json();
  showToast(`✅ Updated ${updated} order${updated === 1 ? "" : "s"}`);

  if ($("bulkCheckAll")) $("bulkCheckAll").checked = false;
  await loadDashboard(); // refresh immediately
}

/* ===== events ===== */
document.querySelectorAll(".tabBtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tabBtn")
      .forEach((b) => b.classList.remove("primary"));
    btn.classList.add("primary");
    activeStatus = btn.dataset.status || "";
    renderOrdersTable();
  });
});

$("applyFilterBtn")?.addEventListener("click", () => {
  activeDate = $("dateFilter")?.value || "";
  activeYear = $("yearFilter")?.value || "";
  renderOrdersTable();
});

$("searchInput")?.addEventListener("input", renderOrdersTable);

$("bulkCheckAll")?.addEventListener("change", (e) => {
  const on = !!e.target.checked;
  document.querySelectorAll(".orderCheck").forEach((cb) => (cb.checked = on));
});

// Row actions: View + Cancel
$("ordersBody")?.addEventListener("click", async (e) => {
  const viewBtn = e.target.closest("[data-view]");
  if (viewBtn) {
    const orderId = viewBtn.getAttribute("data-view");
    if (orderId) {
      window.location.href = `stall-orders.html?orderId=${encodeURIComponent(orderId)}`;
    }
    return;
  }

  const cancelBtn = e.target.closest("[data-cancel]");
  if (cancelBtn) {
    const orderId = cancelBtn.getAttribute("data-cancel");
    if (!confirm("Cancel this order? This cannot be undone.")) return;

    cancelBtn.disabled = true;
    cancelBtn.textContent = "Cancelling…";

    try {
      const res = await fetch(`${API_BASE}/api/stall/orders/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      showToast("Order cancelled");
      await loadDashboard();
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to cancel order.");
      cancelBtn.disabled = false;
      cancelBtn.textContent = "Cancel";
    }
  }
});

$("bulkApplyBtn")?.addEventListener("click", async () => {
  const sel = $("bulkActionSelect")?.value || "";
  try {
    await bulkUpdateStatus(sel);
  } catch (err) {
    console.error(err);
    alert("Bulk update failed.");
  }
});

$("logoutBtn")?.addEventListener("click", () => {
  location.href = "signin.html";
});

/* ===== boot ===== */
loadDashboard();
setInterval(loadDashboard, POLL_MS);
