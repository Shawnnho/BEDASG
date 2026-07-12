/*************************************************
 * qr.js — Hawker Point
 * - Reads checkoutId from URL
 * - Loads the checkout via GET /api/checkoutCard/:checkoutId
 * - Shows amount + QR image
 * - Confirm → POST /api/checkoutCard/:checkoutId/pay
 *   (no real payment gateway — this just simulates success)
 *************************************************/

async function api(endpoint, method = 'GET', body = null) {
  const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body && { body: JSON.stringify(body) })
  };
  const res = await fetch(`/api${endpoint}`, options);
  if (!res.ok) throw new Error('API Error');
  return await res.json();
}

async function checkLogin() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      return { uid: data.user.id };
    }
    return null;
  } catch (err) {
    return null;
  }
}

function money(n) {
  return (Number(n) || 0).toFixed(2);
}

function getCheckoutIdFromUrl() {
  const url = new URL(window.location.href);
  return url.searchParams.get("checkoutId") || "";
}

// Returns { checkout, orders, items }
async function loadCheckout(checkoutId) {
  try {
    return await api(`/checkoutCard/${checkoutId}`);
  } catch (e) {
    return null;
  }
}

async function markCheckoutPaid(checkoutId, paymentRef) {
  return await api(`/checkoutCard/${checkoutId}/pay`, 'POST', { paymentRef });
}

async function main() {
  const amountText = document.getElementById("amountText");
  const statusText = document.getElementById("statusText");
  const confirmBtn = document.getElementById("confirmBtn");

  const checkoutId = getCheckoutIdFromUrl();
  if (!checkoutId) {
    alert("Missing checkoutId in URL.");
    window.location.href = "cart.html";
    return;
  }

  const user = await checkLogin();
  if (!user) {
    alert("Please sign in to continue.");
    window.location.href = "account.html";
    return;
  }

  confirmBtn.disabled = true;

  const summary = await loadCheckout(checkoutId);
  if (!summary || !Array.isArray(summary.orders) || !summary.orders.length) {
    alert("Checkout not found.");
    window.location.href = "cart.html";
    return;
  }

  // Ownership check — Checkout row's UserId, or the order's CustomerId if
  // there's no linked Checkout row (bare single-order case).
  const ownerId = summary.checkout?.UserId ?? summary.orders[0]?.CustomerId;
  if (ownerId && ownerId !== "guest" && ownerId !== user.uid) {
    alert("You do not have access to this checkout.");
    window.location.href = "home.html";
    return;
  }

  const total =
    summary.checkout?.PricingTotal ??
    summary.orders.reduce((sum, o) => sum + Number(o.TotalAmount || 0), 0);

  if (amountText) amountText.textContent = money(total);
  confirmBtn.disabled = false;

  confirmBtn.addEventListener("click", async () => {
    try {
      confirmBtn.disabled = true;
      if (statusText) statusText.textContent = "Confirming payment...";

      // No real gateway wired up — this simulates a successful scan-and-pay.
      const paymentRef = `QR-${Date.now()}`;
      const result = await markCheckoutPaid(checkoutId, paymentRef);

      if (!result || !result.success) {
        throw new Error("Payment was not confirmed by the server");
      }

      if (statusText) statusText.textContent = "Payment confirmed!";

      setTimeout(() => {
        window.location.href = `payment_recieved.html?checkoutId=${encodeURIComponent(checkoutId)}`;
      }, 600);
    } catch (err) {
      console.error(err);
      alert("Payment confirmation failed. Please try again.");
      if (statusText) statusText.textContent = "";
      confirmBtn.disabled = false;
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}