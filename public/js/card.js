async function api(endpoint, method = 'GET', body = null) {
  const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body && { body: JSON.stringify(body) })
  };
  try {
      const res = await fetch(`/api${endpoint}`, options);
      if (!res.ok) throw new Error('API Error');
      return await res.json();
  } catch (err) {
      throw err;
  }
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

async function loadCheckout(checkoutId) {
  try {
    return await api(`/checkoutCard/${checkoutId}`);
  } catch (e) {
    return null;
  }
}

async function markCheckoutPaid(checkout, paymentData) {
  await api(`/checkoutCard/${checkout.id}/pay`, 'POST', paymentData);
}

let isCardValid = false;
const cardNoEl = document.getElementById("cardNo");
const expEl = document.getElementById("exp");
const cvcEl = document.getElementById("cvc");
const payBtn = document.getElementById("payBtn");
const cardTypeIcon = document.getElementById("cardTypeIcon");

function validateFields() {
    const cardDigits = (cardNoEl.value || "").replace(/\D/g, "");
    const exp = (expEl.value || "").trim();
    const cvc = (cvcEl.value || "").trim();

    if (cardTypeIcon) {
        if (/^4/.test(cardDigits)) {
            cardTypeIcon.src = "images/visa.png";
            cardTypeIcon.hidden = false;
        } else if (/^5[1-5]/.test(cardDigits)) {
            cardTypeIcon.src = "images/mastardcard.png";
            cardTypeIcon.hidden = false;
        } else if (/^3[47]/.test(cardDigits)) {
            cardTypeIcon.src = "images/amex.png";
            cardTypeIcon.hidden = false;
        } else {
            cardTypeIcon.src = "";
            cardTypeIcon.hidden = true;
        }
    }

    const cardValid = /^\d{15,16}$/.test(cardDigits);
    const expValid = exp.length === 5 && exp[2] === "/" && /^(0[1-9]|1[0-2])\/\d{2}$/.test(exp);
    const cvcValid = /^\d{3,4}$/.test(cvc);

    isCardValid = cardValid && expValid && cvcValid;

    if (isCardValid) {
      payBtn.disabled = false;
      payBtn.classList.add("isReady");
    } else {
      payBtn.disabled = true;
      payBtn.classList.remove("isReady");
    }
}

async function initCard() {
  const amountText = document.getElementById("amountText");
  const form = document.getElementById("cardForm");

  const user = await checkLogin();
  const checkoutId = getCheckoutIdFromUrl();

  if (!checkoutId) {
    window.location.href = "cart.html";
    return;
  }

  if (!user) {
    window.location.href = "account.html";
    return;
  }

  payBtn.disabled = true;
  payBtn.classList.remove("isReady");

  const checkout = await loadCheckout(checkoutId);
  if (!checkout) {
    window.location.href = "cart.html";
    return;
  }

  if (checkout.userId && checkout.userId !== user.uid) {
    window.location.href = "home.html";
    return;
  }

  const total = checkout.total || checkout.pricing?.total || checkout.TotalAmount || 0;
  if (amountText) amountText.textContent = money(total);
  if (payBtn) payBtn.textContent = `Pay $${money(total)}`;

  if (cardNoEl) cardNoEl.addEventListener("input", validateFields);
  if (expEl) expEl.addEventListener("input", validateFields);
  if (cvcEl) cvcEl.addEventListener("input", validateFields);

  validateFields();

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!isCardValid) {
        return;
      }

      try {
        payBtn.disabled = true;

        const cardDigits = (cardNoEl.value || "").replace(/\D/g, "");
        const last4 = cardDigits.slice(-4);

        const paymentData = {
          method: "Credit / Debit Card",
          status: "Paid",
          ref: `CARD-${Date.now()}`,
          last4
        };

        await markCheckoutPaid(checkout, paymentData);

        setTimeout(() => {
          window.location.href = `payment_recieved.html?checkoutId=${encodeURIComponent(checkoutId)}`;
        }, 600);
      } catch (err) {
        payBtn.disabled = false;
        validateFields();
      }
    });
  }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCard);
} else {
    initCard();
}