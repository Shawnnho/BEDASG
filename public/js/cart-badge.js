/*************************************************
 * cart-badge.js (module)
 * - Populates the header cart badge (#cartCount / #cartCountMobile)
 *   on pages that don't otherwise load the full cart.js logic.
 * - Mirrors cart.js's cart-reading rules: logged-in users read the
 *   DB cart via /api/cart/:uid, guests read the local "hp_cart" cart.
 *************************************************/
const CART_KEY = "hp_cart";

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

function readLocalCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(cart) ? cart : [];
  } catch {
    return [];
  }
}

async function readCloudCart(uid) {
  try {
    const res = await fetch(`/api/cart/${uid}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.items || data.data || [];
  } catch {
    return [];
  }
}

function calcCount(cart) {
  return cart.reduce(
    (c, it) => c + (Number(it.qty ?? it.Qty ?? it.Quantity ?? 1) || 1),
    0,
  );
}

function updateBadges(count) {
  const el = document.getElementById("cartCount");
  if (el) {
    el.textContent = String(count);
    el.classList.toggle("isZero", count <= 0);
  }
  const elM = document.getElementById("cartCountMobile");
  if (elM) {
    elM.textContent = String(count);
    elM.classList.toggle("isZero", count <= 0);
  }
}

(async function initCartBadge() {
  const user = await checkLogin();
  const cart = user ? await readCloudCart(user.uid) : readLocalCart();
  updateBadges(calcCount(cart));
})();
