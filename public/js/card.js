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

async function markCheckoutPaid(checkoutId, paymentData) {
  return await api(`/checkoutCard/${checkoutId}/pay`, 'POST', paymentData);
}

let isCardValid = false;
let selectedSavedCard = null;

const cardNoEl = document.getElementById("cardNo");
const expEl = document.getElementById("exp");
const cvcEl = document.getElementById("cvc");
const payBtn = document.getElementById("payBtn");
const cardTypeIcon = document.getElementById("cardTypeIcon");
const saveCardChk = document.getElementById("saveCardChk");
const useNewCardBtn = document.getElementById("useNewCardBtn");

function brandLabel(brand) {
    if (brand === "visa") return "Visa";
    if (brand === "mastercard") return "Mastercard";
    if (brand === "amex") return "American Express";
    return "Card";
}

async function loadSavedCards(uid) {
    try {
        return await api(`/savedcards/${uid}`);
    } catch {
        return [];
    }
}

async function maybeSaveCard(uid, cardDigits, exp) {
    if (!saveCardChk || !saveCardChk.checked) return;

    const [mm, yy] = exp.split("/");
    const brand = detectCardBrand(cardDigits);

    try {
        await api(`/savedcards/${uid}`, "POST", {
            brand,
            last4: cardDigits.slice(-4),
            expMonth: Number(mm),
            expYear: 2000 + Number(yy),
        });
    } catch {
        console.warn("Could not save card for future use.");
    }
}

function detectCardBrand(cardDigits) {
    if (/^4/.test(cardDigits)) return "visa";
    if (/^5[1-5]/.test(cardDigits)) return "mastercard";
    if (/^3[47]/.test(cardDigits)) return "amex";
    return "card";
}

function validateFields() {
    let cardDigits = (cardNoEl.value || "").replace(/\D/g, "");
    const rawCard = cardNoEl.value || "";
    const exp = (expEl.value || "").trim();
    const cvc = (cvcEl.value || "").trim();

    if (selectedSavedCard) {
        const expectedMask = "•••• •••• •••• " + selectedSavedCard.Last4;
        if (rawCard !== expectedMask) {
            selectedSavedCard = null;
            if (useNewCardBtn) useNewCardBtn.hidden = true;
        }
    }

    let cardValid = false;
    let expValid = false;

    if (selectedSavedCard) {
        cardValid = true;
        const expectedExp = String(selectedSavedCard.ExpMonth).padStart(2, '0') + "/" + String(selectedSavedCard.ExpYear).slice(-2);
        
        if (exp === expectedExp) {
            expValid = true;
        } else {
            expValid = exp.length === 5 && exp[2] === "/" && /^(0[1-9]|1[0-2])\/\d{2}$/.test(exp);
        }

        if (cardTypeIcon) {
            const brand = selectedSavedCard.CardBrand;
            if (brand === "visa") {
                cardTypeIcon.src = "images/visa.png";
                cardTypeIcon.hidden = false;
            } else if (brand === "mastercard") {
                cardTypeIcon.src = "images/mastardcard.png";
                cardTypeIcon.hidden = false;
            } else if (brand === "amex") {
                cardTypeIcon.src = "images/amex.png";
                cardTypeIcon.hidden = false;
            } else {
                cardTypeIcon.src = "";
                cardTypeIcon.hidden = true;
            }
        }
    } else {
        cardValid = /^\d{15,16}$/.test(cardDigits);
        expValid = exp.length === 5 && exp[2] === "/" && /^(0[1-9]|1[0-2])\/\d{2}$/.test(exp);

        if (cardTypeIcon) {
            const brand = detectCardBrand(cardDigits);
            if (brand === "visa") {
                cardTypeIcon.src = "images/visa.png";
                cardTypeIcon.hidden = false;
            } else if (brand === "mastercard") {
                cardTypeIcon.src = "images/mastardcard.png";
                cardTypeIcon.hidden = false;
            } else if (brand === "amex") {
                cardTypeIcon.src = "images/amex.png";
                cardTypeIcon.hidden = false;
            } else {
                cardTypeIcon.src = "";
                cardTypeIcon.hidden = true;
            }
        }
    }

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

  const summary = await loadCheckout(checkoutId);
  if (!summary || !Array.isArray(summary.orders) || !summary.orders.length) {
    window.location.href = "cart.html";
    return;
  }

  const ownerId = summary.checkout?.UserId ?? summary.orders[0]?.CustomerId;
  if (ownerId && ownerId !== "guest" && ownerId !== user.uid) {
    window.location.href = "home.html";
    return;
  }

  const total =
    summary.checkout?.PricingTotal ??
    summary.orders.reduce((sum, o) => sum + Number(o.TotalAmount || 0), 0);

  if (amountText) amountText.textContent = money(total);
  if (payBtn) payBtn.textContent = `Pay $${money(total)}`;

  const cards = await loadSavedCards(user.uid);
  const activeCard = (cards || []).find(
    (c) => c.InUse === 1 || c.InUse === true,
  );

  if (activeCard) {
      selectedSavedCard = activeCard;
      if (cardNoEl) cardNoEl.value = "•••• •••• •••• " + selectedSavedCard.Last4;
      if (expEl) expEl.value = String(selectedSavedCard.ExpMonth).padStart(2, '0') + "/" + String(selectedSavedCard.ExpYear).slice(-2);
      if (saveCardChk) saveCardChk.checked = true; 
      if (useNewCardBtn) useNewCardBtn.hidden = false;
  }
  // No card marked InUse (none set as active, or the active one was
  // deleted) — leave the form blank instead of guessing.

  if (useNewCardBtn) {
      useNewCardBtn.addEventListener("click", () => {
          selectedSavedCard = null;
          if (cardNoEl) cardNoEl.value = "";
          if (expEl) expEl.value = "";
          if (cvcEl) cvcEl.value = "";
          if (saveCardChk) saveCardChk.checked = false;
          useNewCardBtn.hidden = true;
          validateFields();
          if (cardNoEl) cardNoEl.focus();
      });
  }

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
        let last4;

        if (selectedSavedCard) {
            last4 = selectedSavedCard.Last4;
        } else {
            const cardDigits = (cardNoEl.value || "").replace(/\D/g, "");
            last4 = cardDigits.slice(-4);
            await maybeSaveCard(user.uid, cardDigits, expEl.value.trim());
        }

        const paymentData = {
          paymentRef: `CARD-${Date.now()}-${last4}`,
        };

        const result = await markCheckoutPaid(checkoutId, paymentData);
        if (!result || !result.success) {
          throw new Error("Payment was not confirmed by the server");
        }

        setTimeout(() => {
          window.location.href = `payment_recieved.html?checkoutId=${encodeURIComponent(checkoutId)}`;
        }, 600);
      } catch (err) {
        payBtn.disabled = false;
        validateFields();
        alert("Payment failed. Please try again.");
      }
    });
  }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCard);
} else {
    initCard();
}