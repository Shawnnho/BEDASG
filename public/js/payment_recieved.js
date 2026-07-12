/*************************************************
 * payment_recieved.js
 * Reads order/checkout data from the SQL Server backend
 * (dbo.Checkouts / dbo.Orders / dbo.OrderItems) via:
 *   GET /api/checkoutCard/:id
 * Works with either ?checkoutId=XXXX or ?orderId=YYYY —
 * the backend resolves either one to the same summary shape.
 *************************************************/

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

  // Cash orders have no PaidAt yet, so estimate pickup off CreatedAt instead.
  const anchorDate = paidDate || (isCash ? tsToDate(createdAtRaw) : null);

  const pickupEl = document.getElementById("prPickupTime");
  if (pickupEl) {
    if (anchorDate) {
      const from = addMinutes(anchorDate, 15);
      const to = addMinutes(anchorDate, 20);
      pickupEl.textContent = `${formatTimeOnly(from)} – ${formatTimeOnly(to)}`;
    } else {
      pickupEl.textContent = "—";
    }
  }
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
        it.VariantLabel ? `Selected: ${it.VariantLabel}` : "",
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

async function loadSummary(id) {
  const summary = await api(`/checkoutCard/${encodeURIComponent(id)}`);
  const { checkout, orders, items } = summary;

  if (!orders || !orders.length) throw new Error("Order not found.");

  // Order No. display
  const orderIdEl = document.getElementById("prOrderId");
  if (orderIdEl) {
    const nos = orders.map((o) => o.OrderNo || o.OrderId);
    orderIdEl.textContent = nos.length === 1 ? nos[0] : nos.join(", ");
  }

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

  const stallNames = Array.from(new Set(orders.map((o) => o.StallName).filter(Boolean)));
  const stallsEl = document.getElementById("prStalls");
  if (stallsEl) stallsEl.textContent = stallNames.length ? stallNames.join(", ") : "—";

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