// stall-orders.js — MSSQL/Express version (no Firebase), cookie auth
// Loads unpaid-cash / paid / completed orders and allows confirming cash.

const API_BASE = "";
const $ = (id) => document.getElementById(id);

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
    <li style="margin: 8px 0;">
      <div style="display:flex; justify-content:space-between; gap:10px;">
        <div><b>${qty}×</b> ${name}</div>
        <div style="font-weight:800;">${money(it.lineTotal)}</div>
      </div>
      <div class="legal-muted">${money(it.unitPrice)} each</div>
      ${required}
      ${addons}
      ${note}
      ${variant}
    </li>`;
}

function renderOrderCard(o, opts = {}) {
  const { showConfirmCashBtn = false } = opts;

  const displayId = esc(
    o.orderNo || `#${String(o.orderId).slice(-6).toUpperCase()}`,
  );
  const paidAt = o.paidAt ? fmtTime(o.paidAt) : "Not paid yet";
  const type = o.fulfillmentType || "pickup";
  const typeLabel = type === "delivery" ? "Delivery" : "Pickup";

  const addrLine =
    type === "delivery"
      ? `${esc(o.fulfillmentAddress)}, #${esc(o.fulfillmentUnit)}, S(${esc(o.fulfillmentPostal)})`
      : "";

  const itemsHtml =
    Array.isArray(o.items) && o.items.length
      ? o.items.map(renderItem).join("")
      : `<li class="legal-muted">No items found.</li>`;

  const statusText = String(o.status || "").replaceAll("_", " ");

  const confirmBtn = showConfirmCashBtn
    ? `<div style="margin-top:12px; display:flex; justify-content:flex-end;">
         <button class="pill" type="button" data-confirm-cash="${esc(o.orderId)}">Confirm Cash Received</button>
       </div>`
    : "";

  return `
    <div class="legal-card" style="padding:14px; border-radius:16px; box-shadow:0 8px 22px rgba(0,0,0,.08); background:#fff; margin:12px 0;">
      <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <div>
          <div style="font-weight:900; font-size:16px;">Order ${displayId}</div>
          <div class="legal-muted">Created: ${esc(fmtTime(o.createdAt))}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:900;">${esc(statusText)}</div>
          <div class="legal-muted">Payment: ${esc(o.paymentMethod)} • ${esc(paidAt)}</div>
        </div>
      </div>

      <hr style="border:none; border-top:1px solid rgba(0,0,0,.08); margin:12px 0;" />

      <div>
        <div><span class="legal-muted">Fulfillment:</span> <b>${esc(typeLabel)}</b></div>
        ${type === "delivery" ? `<div style="margin-top:6px;"><span class="legal-muted">Address:</span> ${addrLine}</div>` : ""}
      </div>

      <div style="margin-top:12px;">
        <div style="font-weight:900; margin-bottom:6px;">Items</div>
        <ul class="legal-list" style="margin:0; padding-left:18px;">${itemsHtml}</ul>
      </div>

      <div style="margin-top:12px;">
        <div style="display:flex; justify-content:space-between;">
          <span class="legal-muted">Subtotal</span><b>${money(o.pricing.subtotal)}</b>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span class="legal-muted">Delivery Fee</span><b>${money(o.pricing.deliveryFee)}</b>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span class="legal-muted">Small Order Fee</span><b>${money(o.pricing.smallOrderFee)}</b>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span class="legal-muted">Promo (${esc(o.promo.code)})</span><b>- ${money(o.promo.discount)}</b>
        </div>
        <hr style="border:none; border-top:1px dashed rgba(0,0,0,.15); margin:10px 0;" />
        <div style="display:flex; justify-content:space-between; font-size:16px;">
          <span style="font-weight:900;">Total</span><span style="font-weight:900;">${money(o.pricing.total)}</span>
        </div>
      </div>

      ${confirmBtn}
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

  const unpaid = data.unpaidCash || [];
  const paid = data.paid || [];
  const completed = data.completed || [];

  setText("unpaidMeta", String(unpaid.length));
  setText("paidMeta", String(paid.length));
  setText("completedMeta", String(completed.length));

  $("unpaidEmpty").style.display = unpaid.length ? "none" : "block";
  $("paidEmpty").style.display = paid.length ? "none" : "block";
  $("completedEmpty").style.display = completed.length ? "none" : "block";

  $("unpaidList").innerHTML = unpaid
    .map((o) => renderOrderCard(o, { showConfirmCashBtn: true }))
    .join("");
  $("paidList").innerHTML = paid.map((o) => renderOrderCard(o)).join("");
  $("completedList").innerHTML = completed
    .map((o) => renderOrderCard(o))
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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast("✅ Cash confirmed");
    await refresh();
  } catch (err) {
    console.error(err);
    alert("Failed to confirm cash payment.");
    btn.disabled = false;
    btn.textContent = "Confirm Cash Received";
  }
});

$("logoutBtn")?.addEventListener("click", () => {
  location.href = "signin.html";
});

/* ===== boot ===== */
refresh();
