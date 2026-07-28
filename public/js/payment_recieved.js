async function api(endpoint) {
  const res = await fetch(`/api${endpoint}`);
  if (!res.ok) throw new Error("API Error");
  return await res.json();
}

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
  return (m || "—").toString();
}

function setDeliveryBox(fulfillmentType, address) {
  const box = document.getElementById("prDeliveryBox");
  if (!box) return;

  if (String(fulfillmentType || "").toLowerCase() !== "delivery") {
    box.hidden = true;
    return;
  }

  box.hidden = false;
  const addressEl = document.getElementById("prDeliveryAddress");
  const postalEl = document.getElementById("prDeliveryPostal");
  const unitEl = document.getElementById("prDeliveryUnit");

  if (addressEl) addressEl.textContent = address?.line1 || "—";
  if (postalEl) postalEl.textContent = address?.postal || "—";
  if (unitEl) unitEl.textContent = address?.unit || "—";
}

function tsToDate(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatDateTime(d) {
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60000);
}

function formatTimeOnly(d) {
  if (!d) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function setPaidAtAndPickup(paidAtRaw, isCash, createdAtRaw) {
  const paidDate = tsToDate(paidAtRaw);

  const paidAtEl = document.getElementById("prPaidAt");
  if (paidAtEl) {
    if (paidDate) {
      paidAtEl.textContent = formatDateTime(paidDate);
    } else if (isCash) {
      paidAtEl.textContent = "Pay at pickup / delivery";
    } else {
      paidAtEl.textContent = "—";
    }
  }

  const anchorDate = paidDate || (isCash ? tsToDate(createdAtRaw) : null);

  const pickupEl = document.getElementById("prPickupTime");
  if (pickupEl) {
    if (anchorDate) {
      const from = addMinutes(anchorDate, 1);
      const to = addMinutes(anchorDate, 3);
      pickupEl.textContent = `${formatTimeOnly(from)} – ${formatTimeOnly(to)}`;
    } else {
      pickupEl.textContent = "—";
    }
  }
}

function formatVariantLabel(variant) {
  return String(variant || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderItems(orders, items) {
  const container = document.getElementById("prItems");
  if (!container) return;
  container.innerHTML = "";

  orders.forEach((o) => {
    const orderItems = items.filter((it) => it.OrderId === o.OrderId);

    orderItems.forEach((it) => {
      const addons = safeParseArray(it.AddonsJson);
      const required = safeParseArray(it.RequiredModifiersJson);

      const meta = [
        `Order No: ${o.OrderNo || o.OrderId}`,
        o.StallName ? `Stall: ${o.StallName}` : "",
        `${it.Quantity} x ${it.ItemName}`,
        it.VariantKey ? `Selected: ${formatVariantLabel(it.VariantKey)}` : "",
        addons.length ? `Add-ons: ${addons.map((a) => a.label || a.id || "").join(", ")}` : "",
        it.ItemNote ? `Note: ${it.ItemNote}` : "",
      ].filter(Boolean);

      const card = document.createElement("div");
      card.className = "pr-itemCard";
      card.innerHTML = `
        <div>
          <div class="pr-itemName">${it.ItemName}</div>
          <div class="pr-itemMeta">${meta.join("<br>")}</div>
        </div>
        <img class="pr-itemImg" src="${it.ImageUrl || "images/defaultFood.png"}" />
      `;
      container.appendChild(card);
    });
  });
}

function safeParseArray(str) {
  if (!str) return [];
  try {
    const v = JSON.parse(str);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function showError(msg) {
  const loading = document.getElementById("prLoading");
  const card = document.getElementById("prCard");
  const errBox = document.getElementById("prError");
  const errMsg = document.getElementById("prErrorMsg");

  if (loading) loading.hidden = true;
  if (card) card.hidden = true;
  if (errBox) errBox.hidden = false;
  if (errMsg) errMsg.textContent = msg || "Please try again.";
}

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function prettyCancelReason(reason) {
  const x = String(reason || "").trim();
  if (!x) return "";
  const spaced = x.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function applyRefundState(orders) {
  const refundedOrder = orders.find(
    (o) => String(o.RefundStatus || "").toLowerCase() === "refunded",
  );
  const cancelledOrder = orders.find((o) => !!o.CancelledAt);

  const target = refundedOrder || cancelledOrder;
  if (!target) return;

  hideInlineQr();

  const isRefund = !!refundedOrder;

  const iconWrap = document.querySelector(".pr-check");
  if (iconWrap) {
    iconWrap.innerHTML = "";
    iconWrap.classList.add("pr-check--refunded");
    const cross = document.createElement("img");
    cross.src = "images/remove.png";
    cross.alt = isRefund ? "Order refunded" : "Order cancelled";
    cross.className = "pr-check-img";
    iconWrap.appendChild(cross);
  }

  const titleEl = document.querySelector(".pr-title");
  if (titleEl) titleEl.textContent = isRefund ? "Order Refunded" : "Order Cancelled";

  const subEl = document.querySelector(".pr-sub");
  if (subEl) {
    if (isRefund) {
      const refundedAt = tsToDate(target.RefundedAt);
      subEl.textContent = refundedAt
        ? `Sorry! This order was refunded on ${formatDateTime(refundedAt)}.`
        : "Sorry! This order has been refunded.";
    } else {
      const cancelledAt = tsToDate(target.CancelledAt);
      const reason = prettyCancelReason(target.CancelReason);
      const reasonText = reason ? ` Reason: ${reason}.` : "";
      subEl.textContent = cancelledAt
        ? `Sorry! This order was cancelled on ${formatDateTime(cancelledAt)}.${reasonText}`
        : `Sorry! This order has been cancelled.${reasonText}`;
    }
  }
}

const QR_REVEAL_DELAY_MS = 60000;

// Once the QR has been shown for an order, remember it in localStorage so
// leaving the page and coming back doesn't restart the wait — it just
// shows immediately. This is per-browser, not synced across devices.
const QR_REVEALED_STORAGE_KEY = "hp_qrRevealedOrders";

function getRevealedQrIds() {
  try {
    const raw = localStorage.getItem(QR_REVEALED_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function markQrRevealed(id) {
  try {
    const ids = getRevealedQrIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(QR_REVEALED_STORAGE_KEY, JSON.stringify(ids));
    }
  } catch {
    // localStorage unavailable (private browsing, quota, etc) — fails
    // silently, QR just re-times on the next visit instead of persisting.
  }
}

function isQrAlreadyRevealed(id) {
  return getRevealedQrIds().includes(id);
}

function setupInlineQr(id, orderNo) {
  const container = document.getElementById("inlineQrContainer");
  const img = document.getElementById("inlineQrImg");
  const orderEl = document.getElementById("inlineQrOrderNo");

  if (!container || !img) return;

  if (container._qrTimer) clearTimeout(container._qrTimer);

  const reveal = () => {
    if (orderEl) orderEl.textContent = orderNo || "—";
    img.src = `/api/checkoutCard/${encodeURIComponent(id)}/qr?ts=${Date.now()}`;
    container.hidden = false;
    markQrRevealed(id);
  };

  if (isQrAlreadyRevealed(id)) {
    reveal();
    return;
  }

  container.hidden = true;
  container._qrTimer = setTimeout(reveal, QR_REVEAL_DELAY_MS);
}

function hideInlineQr() {
  const container = document.getElementById("inlineQrContainer");
  if (!container) return;
  if (container._qrTimer) clearTimeout(container._qrTimer);
  container.hidden = true;
}

function setupCancelButton(id, orders) {
  const btn = document.getElementById("btnCancel");
  if (!btn) return;

  const isRefunded = orders.some(
    (o) => String(o.RefundStatus || "").toLowerCase() === "refunded",
  );
  const isCancelled = orders.some((o) => !!o.CancelledAt);
  const isCompleted = orders.some(
    (o) => String(o.OrderStatus || "").toLowerCase() === "completed",
  );

  if (isRefunded || isCancelled || isCompleted) {
    btn.hidden = true;
    return;
  }

  btn.hidden = false;
  btn.onclick = async () => {
    if (!confirm("Cancel this order? This cannot be undone.")) return;

    btn.disabled = true;
    btn.textContent = "Cancelling...";

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(id)}/cancel`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Cancel failed");

      await loadSummary(id);
    } catch (err) {
      console.error(err);
      alert("Could not cancel this order. Please try again.");
      btn.disabled = false;
      btn.textContent = "Cancel Order";
    }
  };
}

async function loadSummary(id) {
  const summary = await api(`/checkoutCard/${encodeURIComponent(id)}`);
  const { checkout, orders, items } = summary;

  if (!orders || !orders.length) throw new Error("Order not found.");

  const orderNos = orders.map((o) => o.OrderNo || o.OrderId);
  const primaryOrderNo = orderNos[0] || "—";

  const orderIdEl = document.getElementById("prOrderId");
  if (orderIdEl) orderIdEl.textContent = primaryOrderNo;

  const fulfillmentType = checkout?.FulfillmentType || orders[0].FulfillmentType;
  const address = {
    line1: checkout?.FulfillmentAddress || orders[0].FulfillmentAddress,
    postal: checkout?.FulfillmentPostal || orders[0].FulfillmentPostal,
    unit: checkout?.FulfillmentUnit || orders[0].FulfillmentUnit,
  };
  setDeliveryBox(fulfillmentType, address);

  const paymentMethodRaw = checkout?.PaymentMethod || orders[0].PaymentMethod;
  const isCash = String(paymentMethodRaw || "").toLowerCase().includes("cash");
  const paidAt = checkout?.PaymentPaidAt || orders[0].PaidAt;
  const createdAt = checkout?.CreatedAt || orders[0].CreatedAt;
  setPaidAtAndPickup(paidAt, isCash, createdAt);

  const titleEl = document.querySelector(".pr-title");
  if (titleEl) titleEl.textContent = isCash ? "Order Received" : "Payment Received";

  const stallNames = Array.from(new Set(orders.map((o) => o.StallName).filter(Boolean)));
  const stallsEl = document.getElementById("prStalls");
  if (stallsEl) {
    if (!stallNames.length) {
      stallsEl.textContent = "—";
    } else if (stallNames.length <= 2) {
      stallsEl.textContent = stallNames.join(", ");
    } else {
      stallsEl.textContent = `${stallNames.slice(0, 2).join(", ")} +${stallNames.length - 2} more`;
      stallsEl.title = stallNames.join(", ");
    }
  }

  const payMethodEl = document.getElementById("prPayMethod");
  if (payMethodEl) {
    payMethodEl.textContent = prettyPayMethod(checkout?.PaymentMethod || orders[0].PaymentMethod);
  }

  const totalEl = document.getElementById("prTotalPaid");
  const total = checkout?.PricingTotal ?? orders.reduce((s, o) => s + Number(o.TotalAmount || 0), 0);
  if (totalEl) totalEl.textContent = `$${money(total)}`;

  const btnStatus = document.getElementById("btnStatus");
  if (btnStatus) {
    btnStatus.href = `orders.html?${checkout ? "checkoutId" : "orderId"}=${encodeURIComponent(id)}`;
  }

  renderItems(orders, items || []);
  applyRefundState(orders);
  setupCancelButton(id, orders);
  setupInlineQr(id, primaryOrderNo);

  const loading = document.getElementById("prLoading");
  const errBox = document.getElementById("prError");
  const card = document.getElementById("prCard");

  if (loading) loading.hidden = true;
  if (errBox) errBox.hidden = true;
  if (card) card.hidden = false;
}

(async () => {
  try {
    const user = await checkLogin();
    if (!user) {
      showError("Please sign in to view your payment receipt.");
      return;
    }

    const id = getQueryParam("checkoutId") || getQueryParam("orderId");
    if (!id) {
      showError("Missing checkoutId or orderId in the URL.");
      return;
    }

    await loadSummary(id);
  } catch (err) {
    console.error(err);
    showError(err?.message || "Could not load payment details.");
  }
})();