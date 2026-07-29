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

let currentUser = null;

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

const CART_KEY = "hp_cart";
let lastPricing = { subtotal: 0, promoDiscount: 0, smallOrderFee: 0, deliveryFee: 0, total: 0 };
let appliedPromo = null;

function readLocalCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(cart) ? cart : [];
  } catch { return []; }
}

function writeLocalCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart || []));
}

function clearLocalCart() {
    localStorage.removeItem(CART_KEY);
}

async function readCloudCart(uid) {
  try {
      const data = await api(`/cart/${uid}`);
      return Array.isArray(data) ? data : (data.items || data.data || []);
  } catch (e) {
      return [];
  }
}

async function writeCloudCart(uid, cart) {
  await api(`/cart/${uid}`, 'POST', { items: cart });
}

async function readCart() {
  if (!currentUser) return readLocalCart();
  return await readCloudCart(currentUser.uid);
}

async function saveCart(cart) {
  if (!currentUser) return writeLocalCart(cart);
  await writeCloudCart(currentUser.uid, cart);
}

async function fetchPromoByCode(codeRaw) {
  const code = String(codeRaw || "").trim().toUpperCase();
  if (!code) return null;
  try {
      const promos = await api('/promotions');
      if (!promos) return null;
      return promos.find(p => String(p.PromoCode).toUpperCase() === code) || null;
  } catch (e) {
      return null;
  }
}

function showToast(message, isSuccess = true) {
    const toast = document.getElementById("toastNotification");
    if (!toast) return;

    toast.textContent = message;
    toast.className = "toast";
    toast.classList.add("show");
    toast.classList.add(isSuccess ? "success" : "error");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function validatePromoLocally(promo, cart, subtotal) {
  if (!promo) return { ok: false, error: "Invalid promo code." };

  if (promo.RedemptionsLeft != null && promo.RedemptionsLeft <= 0) {
    return { ok: false, error: "This promo has been fully redeemed." };
  }

  if (promo.ExpiresAt && new Date(promo.ExpiresAt) < new Date()) {
    return { ok: false, error: "This promo has expired." };
  }

  if (promo.MinSpend && subtotal < Number(promo.MinSpend)) {
    const shortfall = Number(promo.MinSpend) - subtotal;
    return { ok: false, error: `Add $${shortfall.toFixed(2)} more to use this promo.` };
  }

  if (promo.StallId) {
    const hasStall = cart.some(it => (it.stallId ?? it.StallId) === promo.StallId);
    if (!hasStall) {
      return { ok: false, error: "This promo isn't valid for the stalls in your cart." };
    }
  }

  if (promo.RequiredKeyword) {
    const kw = String(promo.RequiredKeyword).toLowerCase();
    const hasKeyword = cart.some(it => (it.name ?? it.Name ?? "").toLowerCase().includes(kw));
    if (!hasKeyword) {
      return { ok: false, error: `Requires "${promo.RequiredKeyword}" in your cart.` };
    }
  }

  if (promo.ClaimOnce) {
    if (!currentUser) {
      return { ok: false, error: "Log in to use this promo." };
    }
    const claimedKey = "hp_claimedPromoIds";
    const claimed = new Set(JSON.parse(localStorage.getItem(claimedKey) || "[]"));
    if (claimed.has(promo.PromotionId)) {
      return { ok: false, error: "You have already used this promo." };
    }
  }

  return { ok: true };
}

function calcPromoDiscount(promo, subtotal) {
  if (!promo) return 0;
  const type = String(promo.PromoType || "cash").toLowerCase();
  let discount = 0;

  const value = Number(promo.Value ?? promo.DiscountValue ?? promo.DiscountAmount ?? promo.ExactDollarAmount ?? promo.Percentage ?? promo.Discount ?? 0);

  if (type === "cash") discount = value;
  if (type === "percent") discount = subtotal * (value / 100);
  if (type === "freebie") discount = 0;

  if (Number(promo.MaxDiscount) > 0) {
    discount = Math.min(discount, Number(promo.MaxDiscount));
  }

  return Math.min(discount, subtotal);
}

async function clearAppliedPromo(message = "") {
  appliedPromo = null;
  const label = document.getElementById("promoCodeLabel");
  if (label) label.textContent = "None";
  const msg = document.getElementById("redeemMsg");
  if (msg && message) msg.textContent = message;
}

function money(n) {
    return (Number(n) || 0).toFixed(2);
}

function calcCount(cart) {
  return cart.reduce((c, it) => c + (Number(it.qty ?? it.Qty ?? it.Quantity ?? 1) || 1), 0);
}

function updateBadges(count) {
  const el = document.getElementById("cartCount");
  if (el) { el.textContent = String(count); el.classList.toggle("isZero", count <= 0); }
  const elM = document.getElementById("cartCountMobile");
  if (elM) { elM.textContent = String(count); elM.classList.toggle("isZero", count <= 0); }
}

function showReq(id, show) {
  const el = document.getElementById(id);
  if (el) el.hidden = !show;
}

function validateDeliveryFields() {
  const addressEl = document.getElementById("delAddress");
  const postalEl = document.getElementById("delPostal");
  const unitEl = document.getElementById("delUnit");

  const address = addressEl?.value?.trim() || "";
  const postal = postalEl?.value?.trim() || "";
  const unit = unitEl?.value?.trim() || "";

  [addressEl, postalEl, unitEl].forEach(
    (el) => el && el.classList.remove("isInvalid"),
  );

  showReq("reqAddress", false);
  showReq("reqPostal", false);
  showReq("reqUnit", false);

  let ok = true;

  if (!address) {
    showReq("reqAddress", true);
    if(addressEl) addressEl.classList.add("isInvalid");
    ok = false;
  }

  if (!/^\d{6}$/.test(postal)) {
    showReq("reqPostal", true);
    if(postalEl) postalEl.classList.add("isInvalid");
    ok = false;
  }

  if (!unit) {
    showReq("reqUnit", true);
    if(unitEl) unitEl.classList.add("isInvalid");
    ok = false;
  }

  return { ok, addressObj: { address, postal, unit } };
}

function getSelectedPayMethod() {
  const checked = document.querySelector('input[name="payMethod"]:checked');
  return checked ? checked.value : "";
}

function clearPaySelection() {
    document.querySelectorAll('input[name="payMethod"]').forEach(el => el.checked = false);
    syncProceedBtn();
}

function calcDeliveryFee(subtotal) {
    return 2.50;
}

function syncProceedBtn() {
  const btn = document.getElementById("checkoutBtn");
  if (!btn) return;
  const selectedPay = Boolean(getSelectedPayMethod());
  const fulfillment = document.querySelector('input[name="fulfillment"]:checked')?.value || "pickup";
  let deliveryOk = fulfillment === "delivery" ? validateDeliveryFields().ok : true;

  const ready = selectedPay && deliveryOk;
  btn.classList.toggle("isReady", ready);
  btn.classList.toggle("isLocked", !ready);
  btn.disabled = !ready;
}

document.addEventListener("change", (e) => {
  if (e.target.matches('input[name="payMethod"]') || e.target.matches('input[name="fulfillment"]')) {
      if (e.target.matches('input[name="fulfillment"]')) {
          const deliveryFields = document.getElementById("deliveryFields");
          if (deliveryFields) {
              deliveryFields.hidden = e.target.value !== "delivery";
          }
          render();
      }
      syncProceedBtn();
  }
});

document.addEventListener("input", (e) => {
  if (e.target.matches("#delAddress, #delPostal, #delUnit")) {
      syncProceedBtn();
  }
});

async function render() {
  const list = document.getElementById("cartList");
  const empty = document.getElementById("cartEmpty");
  const summary = document.getElementById("cartSummary");
  const subText = document.getElementById("cartSub");
  const promoBox = document.getElementById("promoBox");
  const payBox = document.getElementById("payBox");
  const proceedBtn = document.getElementById("checkoutBtn");
  const fulfillBox = document.getElementById("fulfillBox");
  const clearAllWrap = document.getElementById("clearAllWrap");
  const loadFavBtn = document.getElementById("loadFavBtn");

  let cart = [];
  try {
    cart = await readCart();
  } catch (err) {
    cart = [];
  }

  const count = calcCount(cart);
  updateBadges(count);
  if (subText) subText.textContent = `${count} item${count === 1 ? "" : "s"}`;

  if (!cart || cart.length === 0) {
    if (list) list.innerHTML = "";
    if (empty) empty.hidden = false;
    if (promoBox) promoBox.hidden = true;
    if (summary) summary.hidden = true;
    if (payBox) payBox.hidden = true;
    if (proceedBtn) proceedBtn.hidden = true;
    if (fulfillBox) fulfillBox.hidden = true;
    if (clearAllWrap) clearAllWrap.hidden = true;
    
    let hasFav = false;
    if (currentUser) {
        try {
            const fav = await api(`/favourites/${currentUser.uid}`);
            hasFav = Array.isArray(fav?.items) && fav.items.length > 0;
        } catch (e) {}
    }
    if (loadFavBtn) loadFavBtn.hidden = !hasFav;

    await clearAppliedPromo();
    return;
  }

  if (empty) empty.hidden = true;
  if (promoBox) promoBox.hidden = currentUser ? false : true;
  if (summary) summary.hidden = false;
  if (payBox) payBox.hidden = false;
  if (proceedBtn) proceedBtn.hidden = false;
  if (fulfillBox) fulfillBox.hidden = false;
  if (clearAllWrap) clearAllWrap.hidden = false;
  const saveFavBtn = document.getElementById("saveFavBtn");
  if (saveFavBtn) saveFavBtn.hidden = !currentUser;

  if (!list) return;
  list.innerHTML = "";

  clearPaySelection();

function formatVariantLabel(variant) {
  return String(variant || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

  let subtotal = 0;

  cart.forEach((it, idx) => {
    const name = it.name || it.Name || "Unknown Item";
    const img = it.img || it.Img || 'images/defaultFood.png';
    const qty = Number(it.qty ?? it.Qty ?? 1);
    const unitPrice = Number(it.unitPrice ?? it.UnitPrice ?? 0);
    const line = Number(it.totalPrice ?? it.TotalPrice) || (unitPrice * qty);
    let variant = it.variantKey || ""

    if (variant) variant = `(${variant.replace("_"," ")})`

    subtotal += line;

    list.innerHTML += `
      <article class="menuCard cartCard">
        <div class="menuImgWrap"><img src="${img}"></div>
        <div class="menuInfo">
          <div class="menuName">${name} ${formatVariantLabel(variant)}</div>
          <div class="menuPrice">$${money(line)}</div>
          <div class="cartMeta">Qty: ${qty}</div>
        </div>
        <div class="cartQtyWrap">
          <button class="cartQtyBtn" data-act="plus" data-i="${idx}">+</button>
          <div class="cartQtyNum">${qty}</div>
          <button class="cartQtyBtn" data-act="minus" data-i="${idx}">−</button>
          <button class="cartClearBtn" data-act="clear" data-i="${idx}">Clear</button>
        </div>
      </article>
    `;
  });

  if (appliedPromo) {
    const check = validatePromoLocally(appliedPromo, cart, subtotal);
    if (!check.ok) {
      await clearAppliedPromo(check.error);
    }
  }

  let promoDiscount = calcPromoDiscount(appliedPromo, subtotal);
  const fulfillment = document.querySelector('input[name="fulfillment"]:checked')?.value || "pickup";

  let smallOrderFee = 0;
  if (fulfillment === "delivery" && subtotal < 15) {
    smallOrderFee = Math.min(15 - subtotal, 4);
  }

  let deliveryFee = fulfillment === "delivery" ? calcDeliveryFee(subtotal) : 0;

  const subEl = document.getElementById("sumSubtotal");
  const promoEl = document.getElementById("sumPromo");
  const smallEl = document.getElementById("sumSmallFee");
  const delEl = document.getElementById("sumDelivery");
  const totalEl = document.getElementById("sumTotal");

  if (subEl) subEl.textContent = money(subtotal);
  if (promoEl) promoEl.textContent = money(promoDiscount);
  if (smallEl) smallEl.textContent = money(smallOrderFee);
  if (delEl) delEl.textContent = money(deliveryFee);

  const total = Math.max(0, subtotal - promoDiscount + smallOrderFee + deliveryFee);
  if (totalEl) totalEl.textContent = money(total);

  lastPricing = { subtotal, promoDiscount, smallOrderFee, deliveryFee, total };
  syncProceedBtn();
}

function normalizeCheckoutItem(it) {
  return {
    stallId: it.stallId ?? it.StallId ?? null,
    itemId: it.itemId ?? it.ItemId ?? null,
    name: it.name ?? it.Name ?? "Item",
    img: it.img ?? it.Img ?? null,
    qty: Number(it.qty ?? it.Qty ?? 1),
    unitPrice: Number(it.unitPrice ?? it.UnitPrice ?? 0),
    totalPrice: Number(it.totalPrice ?? it.TotalPrice ?? 0),
    note: it.note ?? it.Note ?? null,
    variantKey: it.variantKey ?? it.VariantKey ?? null,
    variantLabel: it.variantLabel ?? it.VariantLabel ?? null,
    addons: it.addons ?? it.Addons ?? [],
    required: it.required ?? it.RequiredModifiers ?? [],
  };
}

document.addEventListener("click", async (e) => {
  if (e.target.closest("#saveFavBtn")) {
    if (!currentUser) {
        alert("Please log in to save a favourite order.");
        return;
    }
    const cart = await readCart();
    if (cart.length > 0) {
        try {
            await api(`/favourites/${currentUser.uid}`, 'PUT', { items: cart });
            showToast("Order saved as favourite!", true);
        } catch (err) {
            showToast("Could not save favourite. Please try again.", false);
        }
    }
    return;
  }

  if (e.target.closest("#loadFavBtn")) {
    if (!currentUser) return;
    try {
        const fav = await api(`/favourites/${currentUser.uid}`);
        if (fav && Array.isArray(fav.items) && fav.items.length > 0) {
            await saveCart(fav.items);
            render();
        }
    } catch(err) {}
    return;
  }

  const actBtn = e.target.closest("[data-act]");
  if (actBtn) {
    const act = actBtn.getAttribute("data-act");
    const i = Number(actBtn.getAttribute("data-i"));
    const cart = await readCart();
    const item = cart[i];
    if (!item) return;

    let currentQty = Number(item.qty ?? item.Qty ?? 1);
    if (act === "plus") currentQty++;
    if (act === "minus") currentQty--;
    if (act === "clear") currentQty = 0;

    if (currentUser && item.cartItemId) {
      // Logged-in users: real per-item PUT/DELETE against the DB cart.
      try {
        if (currentQty <= 0) {
          await api(`/cart/${currentUser.uid}/items/${item.cartItemId}`, 'DELETE');
        } else {
          await api(`/cart/${currentUser.uid}/items/${item.cartItemId}`, 'PUT', { qty: currentQty });
        }
      } catch (err) {
        alert("Could not update cart. Please try again.");
        return;
      }
    } else {
      // Guests: no DB row to target, fall back to rewriting the local array.
      if (currentQty <= 0) {
        cart.splice(i, 1);
      } else {
        cart[i].qty = currentQty;
        cart[i].Qty = currentQty;
        const price = Number(cart[i].unitPrice ?? cart[i].UnitPrice ?? 0);
        cart[i].totalPrice = currentQty * price;
        cart[i].TotalPrice = currentQty * price;
      }
      await saveCart(cart);
    }

    render();
    return;
  }

  if (e.target.closest("#clearAllBtn")) {
    if (confirm("Are you sure you want to empty your entire cart?")) {
        await saveCart([]);
        render();
    }
    return;
  }

  if (e.target.closest("#redeemBtn")) {
    const code = document.getElementById("redeemInput")?.value;
    const msg = document.getElementById("redeemMsg");

    const cart = await readCart();
    const subtotal = lastPricing.subtotal;

    const promo = await fetchPromoByCode(code);
    const check = validatePromoLocally(promo, cart, subtotal);

    if (check.ok) {
        appliedPromo = promo;
        if (msg) {
            msg.textContent = "Promo applied successfully!";
            msg.style.color = "green";
        }
        const label = document.getElementById("promoCodeLabel");
        if (label) label.textContent = promo.PromoCode;
    } else {
        await clearAppliedPromo(check.error);
        if (msg) msg.style.color = "red";
    }
    render();
  }

  if (e.target.closest("#checkoutBtn")) {
    const checkoutBtn = e.target.closest("#checkoutBtn");
    if (checkoutBtn.disabled) return; // guard against double-click creating two orders
    checkoutBtn.disabled = true;

    const cart = await readCart();
    const fulfillment = document.querySelector('input[name="fulfillment"]:checked')?.value || "pickup";
    const paymentMethod = getSelectedPayMethod();

    const payload = {
        userId: currentUser ? currentUser.uid : "guest",
        items: cart.map(normalizeCheckoutItem),
        paymentMethod,
        fulfillment,
        pricing: lastPricing,
        promoCode: appliedPromo ? appliedPromo.PromoCode : "NONE",
    };

    if (fulfillment === "delivery") {
        payload.address = validateDeliveryFields().addressObj;
    }

    try {
        const res = await api('/checkoutCard/create', 'POST', payload);
        if (res && res.success) {
            if (appliedPromo && appliedPromo.ClaimOnce) {
              const claimedKey = "hp_claimedPromoIds";
              const claimed = new Set(JSON.parse(localStorage.getItem(claimedKey) || "[]"));
              claimed.add(appliedPromo.PromotionId);
              localStorage.setItem(claimedKey, JSON.stringify([...claimed]));
            }

            if (paymentMethod === 'cash') {
                await saveCart([]);
                window.location.href = `payment_recieved.html?checkoutId=${encodeURIComponent(res.checkoutId)}`;
            } else if (paymentMethod === 'card') {
                window.location.href = `card.html?checkoutId=${encodeURIComponent(res.checkoutId)}`;
            } else {
                window.location.href = `qr.html?checkoutId=${encodeURIComponent(res.checkoutId)}`;
            }
        } else {
            alert(res?.error || "Order failed. Please try again.");
            checkoutBtn.disabled = false;
        }
    } catch (err) {
        alert("Server error: Could not submit order. Is your backend running?");
        checkoutBtn.disabled = false;
    }
  }
});

async function initCart() {
    currentUser = await checkLogin();
    render();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCart);
} else {
    initCart();
}