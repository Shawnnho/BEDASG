
// Sections on this page:
//   Refunds Pending — cancelled orders where the customer already paid (owner owes money back)
//   Unpaid (Cash)   — customer chose cash, hasn't handed it over yet
//   Paid            — money received, stall should cook these
//   Completed       — archive; compact rows that expand on click

const API_BASE = "";
const $ = (id) => document.getElementById(id);

/* ===== helpers ===== */
function setText(id, val) {
  const el = $(id);
  if (el) el.textContent = val ?? "—";
}

function money(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

function fmtTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

/* ===== rendering ===== */
function renderItem(it) {
  const name = esc(it.name || "Item");
  const qty = Number(it.qty || 1);

  const required = Array.isArray(it.required)
    ? it.required
        .filter((r) => r.groupTitle || r.optionLabel)
        .map(
          (r) =>
            `<div class="legal-muted" style="margin-top:2px;">• ${esc(r.groupTitle)}: ${esc(r.optionLabel)}</div>`,
        )
        .join("")
    : "";

  const addons = Array.isArray(it.addons)
    ? it.addons
        .map((a) => {
          const label = esc(a.label || "");
          const price = Number(a.price || 0);
          return `<div class="legal-muted" style="margin-top:2px;">+ ${label}${price ? ` (${money(price)})` : ""}</div>`;
        })
        .join("")
    : "";

  const note = it.note
    ? `<div class="legal-muted" style="margin-top:2px;">Note: ${esc(it.note)}</div>`
    : "";

  const variant = it.variantLabel
    ? `<div class="legal-muted" style="margin-top:2px;">Selected: <b>${esc(it.variantLabel)}</b></div>`
    : "";

  return `
    <li>
      <div class="orderItemTop">
        <div><b>${qty}×</b> ${name}</div>
        <div style="font-weight:800;">${money(it.lineTotal)}</div>
      </div>
      <div class="legal-muted" style="font-size:12px;">${money(it.unitPrice)} each</div>
      ${required}
      ${addons}
      ${note}
      ${variant}
    </li>`;
}

function pricingHtml(o) {
  return `
    <div class="orderPricingSh">
      <div class="orderPriceRow"><span>Subtotal</span><span>${money(o.pricing.subtotal)}</span></div>
      <div class="orderPriceRow"><span>Delivery Fee</span><span>${money(o.pricing.deliveryFee)}</span></div>
      <div class="orderPriceRow"><span>Small Order Fee</span><span>${money(o.pricing.smallOrderFee)}</span></div>
      <div class="orderPriceRow"><span>Promo (${esc(o.promo.code)})</span><span>- ${money(o.promo.discount)}</span></div>
      <div class="orderPriceRow total"><span>Total</span><span>${money(o.pricing.total)}</span></div>
    </div>`;
}

function orderDetailHtml(o) {
  const type = o.fulfillmentType || "pickup";
  const typeLabel = type === "delivery" ? "Delivery" : "Pickup";

  const addrLine =
    type === "delivery"
      ? `<div style="margin-top:4px; font-size:13px;">
           <span class="legal-muted">Address:</span>
           ${esc(o.fulfillmentAddress)}, #${esc(o.fulfillmentUnit)}, S(${esc(o.fulfillmentPostal)})
         </div>`
      : "";

  const itemsHtml =
    Array.isArray(o.items) && o.items.length
      ? o.items.map(renderItem).join("")
      : `<li class="legal-muted">No items found.</li>`;

  return `
    <div style="font-size:13px;">
      <span class="legal-muted">Fulfillment:</span> <b>${esc(typeLabel)}</b>
    </div>
    ${addrLine}

    <div class="orderBodySh">
      <div class="orderItemsCol">
        <div class="orderItemsTitle">Items</div>
        <ul class="orderItemsSh">${itemsHtml}</ul>
      </div>
      ${pricingHtml(o)}
    </div>`;
}

// Full card — Unpaid + Paid (owner needs to act on these)
function renderOrderCard(o, opts = {}) {
  const { showConfirmCashBtn = false, showCompleteBtn = false } = opts;

  const displayId = esc(
    o.orderNo || `#${String(o.orderId).slice(-6).toUpperCase()}`,
  );
  const paidAt = o.paidAt ? fmtTime(o.paidAt) : "Not paid yet";
  const statusText = String(o.status || "").replaceAll("_", " ");

  const confirmBtn = showConfirmCashBtn
    ? `<button class="orderActionBtn confirmCash" type="button" data-confirm-cash="${esc(o.orderId)}">Confirm Cash Received</button>`
    : "";

  const completeBtn = showCompleteBtn
    ? `<button class="orderActionBtn markComplete" type="button" data-complete="${esc(o.orderId)}">Mark Completed</button>`
    : "";

  const actions =
    confirmBtn || completeBtn
      ? `<div class="orderActionsSh">${confirmBtn}${completeBtn}</div>`
      : "";

  return `
    <div class="orderCardSh">
      <div class="orderTopSh">
        <div>
          <div class="orderIdSh">Order ${displayId}</div>
          <div class="orderMetaSh">Created: ${esc(fmtTime(o.createdAt))}</div>
        </div>
        <div style="text-align:right;">
          <div class="orderStatusSh">${esc(statusText)}</div>
          <div class="orderMetaSh">${esc(o.paymentMethod)} • ${esc(paidAt)}</div>
        </div>
      </div>

      <hr class="orderDivSh" />
      ${orderDetailHtml(o)}
      ${actions}
    </div>`;
}

// Compact row — Completed (archive; expand on click)
function renderOrderCompact(o) {
  const displayId = esc(
    o.orderNo || `#${String(o.orderId).slice(-6).toUpperCase()}`,
  );
  const itemCount = Array.isArray(o.items) ? o.items.length : 0;

  return `
    <div class="orderCompact" data-oid="${esc(o.orderId)}">
      <div class="orderCompactHead">
        <span class="orderCompactChev">▶</span>
        <span class="orderCompactId">${displayId}</span>
        <span class="orderCompactMeta">
          ${esc(fmtTime(o.createdAt))} • ${itemCount} item${itemCount === 1 ? "" : "s"} • ${esc(o.paymentMethod)}
        </span>
        <span class="orderCompactTotal">${money(o.pricing.total)}</span>
      </div>
      <div class="orderCompactBody">
        ${orderDetailHtml(o)}
      </div>
    </div>`;
}

// Refund row — cancelled order where the customer already paid and is owed money back.
// The owner settles this in person, then marks it done here.
function renderRefundCard(r) {
  const displayId = esc(
    r.orderNo || `#${String(r.orderId).slice(-6).toUpperCase()}`,
  );

  return `
    <div class="refundCard">
      <div class="refundTop">
        <div>
          <div class="refundId">Order ${displayId}</div>
          <div class="refundMeta">
            ${esc(r.customerName)} • Cancelled ${esc(fmtTime(r.cancelledAt))}
          </div>
          <div class="refundMeta">
            Reason: <b>${esc(r.reason)}</b> • Paid by ${esc(r.paymentMethod)}
          </div>
        </div>

        <div class="refundRight">
          <div class="refundAmount">${money(r.amount)}</div>
          <button class="orderActionBtn markRefund" type="button"
                  data-refund="${esc(r.orderId)}">
            Mark Refunded
          </button>
        </div>
      </div>
    </div>`;
}

/* ===== data ===== */
async function loadOrders() {
  const res = await fetch(`${API_BASE}/api/stall/orders`, {
    credentials: "include",
  });

  if (res.status === 401 || res.status === 403) {
    location.href = "signin.html";
    return null;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function render(data) {
  setText("stallName", data.stallName || "—");
  setText("ownerName", data.ownerName || "Owner");

  const refunds = data.pendingRefunds || [];
  const unpaid = data.unpaidCash || [];
  const paid = data.paid || [];
  const completed = data.completed || [];

  // Section counts
  setText("refundMeta", String(refunds.length));
  setText("unpaidMeta", String(unpaid.length));
  setText("paidMeta", String(paid.length));
  setText("completedMeta", String(completed.length));

  // Empty-state messages
  $("refundEmpty").style.display = refunds.length ? "none" : "block";
  $("unpaidEmpty").style.display = unpaid.length ? "none" : "block";
  $("paidEmpty").style.display = paid.length ? "none" : "block";
  $("completedEmpty").style.display = completed.length ? "none" : "block";

  // Lists
  $("refundList").innerHTML = refunds.map(renderRefundCard).join("");

  $("unpaidList").innerHTML = unpaid
    .map((o) => renderOrderCard(o, { showConfirmCashBtn: true }))
    .join("");

  $("paidList").innerHTML = paid
    .map((o) => renderOrderCard(o, { showCompleteBtn: true }))
    .join("");

  $("completedList").innerHTML = completed
    .map((o) => renderOrderCompact(o))
    .join("");

  // Order nav badge — unpaid cash orders needing attention
  const badge = $("orderBadge");
  if (badge) {
    const n = unpaid.length;
    badge.textContent = n > 0 ? String(n) : "";
    badge.style.display = n > 0 ? "grid" : "none";
  }
}

async function refresh() {
  try {
    const data = await loadOrders();
    if (data) render(data);
  } catch (err) {
    console.error("refresh error:", err);
    showToast("Failed to load orders.");
  }
}

/* ===== events ===== */

// Confirm a cash payment was received in person
$("unpaidList")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-confirm-cash]");
  if (!btn) return;

  const orderId = btn.getAttribute("data-confirm-cash");
  btn.disabled = true;
  btn.textContent = "Confirming...";

  try {
    const res = await fetch(`${API_BASE}/api/stall/orders/confirm-cash`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ orderId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    showToast("✅ Cash confirmed");
    await refresh();
  } catch (err) {
    console.error("confirmCash error:", err);
    alert(err.message || "Failed to confirm cash payment.");
    btn.disabled = false;
    btn.textContent = "Confirm Cash Received";
  }
});

// Mark a paid order as completed (food handed over)
$("paidList")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-complete]");
  if (!btn) return;

  const orderId = btn.getAttribute("data-complete");
  btn.disabled = true;
  btn.textContent = "Completing...";

  try {
    const res = await fetch(`${API_BASE}/api/stall/orders/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ orderId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    showToast("✅ Order completed");
    await refresh();
  } catch (err) {
    console.error("completeOrder error:", err);
    alert(err.message || "Failed to complete order.");
    btn.disabled = false;
    btn.textContent = "Mark Completed";
  }
});

// Owner confirms they've physically refunded the customer
$("refundList")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-refund]");
  if (!btn) return;

  const orderId = btn.getAttribute("data-refund");

  if (
    !confirm("Confirm you have refunded this customer? This cannot be undone.")
  ) {
    return;
  }

  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    const res = await fetch(`${API_BASE}/api/stall/orders/refund`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ orderId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    showToast("✅ Refund recorded");
    await refresh();
  } catch (err) {
    console.error("markRefunded error:", err);
    alert(err.message || "Failed to record refund.");
    btn.disabled = false;
    btn.textContent = "Mark Refunded";
  }
});

// Completed rows expand/collapse
$("completedList")?.addEventListener("click", (e) => {
  const head = e.target.closest(".orderCompactHead");
  if (!head) return;
  head.closest(".orderCompact")?.classList.toggle("isOpen");
});

$("logoutBtn")?.addEventListener("click", () => {
  location.href = "signin.html";
});

/* ===== boot ===== */
refresh();