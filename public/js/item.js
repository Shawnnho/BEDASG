/*************************************************
 * item.js (SQL version)
 * - Loads the menu item's details via GET /api/menu/:stallId
 *   (no single-item endpoint exists yet, so we fetch the stall's
 *   full menu and find the matching item client-side)
 * - Loads stall-wide add-ons via GET /api/addons/:stallId
 *   (add-ons are NOT per-item — every active add-on for the stall applies)
 * - Cart is still localStorage-based ("hp_cart") until a real cart
 *   API exists.
 *************************************************/

/* =========================
   URL PARAMS
   NOTE: menu.js's "+" button links here as
   item.html?stallid=...&itemid=... (lowercase). We read those same
   lowercase names here. When navigating back to menu.html we use
   "stallId" (camelCase) since that's what menu.js reads there.
========================= */
const params = new URLSearchParams(window.location.search);
const stallId = params.get("stallid");
const itemId = params.get("itemid");

if (!stallId || !itemId) {
  console.error("Missing URL params");
  window.location.href = "home.html";
}

/* =========================
   DOM
========================= */
const closeBtn = document.getElementById("closeBtn");
const itemImg = document.getElementById("itemImg");
const itemName = document.getElementById("itemName");
const itemBasePrice = document.getElementById("itemBasePrice");
const itemDesc = document.getElementById("itemDesc");
const addonsList = document.getElementById("addonsList");
const sideNoteEl = document.getElementById("sideNote");
const qtyMinus = document.getElementById("qtyMinus");
const qtyPlus = document.getElementById("qtyPlus");
const qtyVal = document.getElementById("qtyVal");
const addToCartBtn = document.getElementById("addToCartBtn");
const selectedVariantText = document.getElementById("selectedVariantText");

/* =========================
   STATE
========================= */
let ITEM = null;
let ADDONS = [];
let qty = 1;
let currentUid = null;
const selectedAddons = new Set();

/**
 * Check auth status via AuthClient (same helper used elsewhere in the
 * app). currentUid is required to read/write this user's cart.
 */
async function checkAuthStatus() {
  const user = await AuthClient.getCurrentUser();
  currentUid = user ? user.id : null;
}

/* =========================
   HELPERS
========================= */
function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function hideAddonsUI() {
  const section = document.getElementById("addonsSection");
  if (section) section.style.display = "none";
}

/* =========================
   LOAD ITEM
   No dedicated single-item endpoint exists, so we fetch the whole
   stall menu and find the item that matches itemId.
========================= */
async function loadItem() {
  try {
    const res = await fetch(`/api/menu/${encodeURIComponent(stallId)}`);
    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);

    const items = await res.json();
    const match = items.find((i) => String(i.id) === String(itemId));

    if (!match) {
      console.error("Item not found");
      window.location.href = `menu.html?stallId=${encodeURIComponent(stallId)}`;
      return;
    }

    ITEM = {
      id: match.id,
      name: match.name || "Unnamed item",
      desc: match.desc || "",
      img: match.img || "images/menu/placeholder.jpg",
      price: match.price != null ? Number(match.price) : 0,
      priceFrom: !!match.priceFrom,
    };

    renderItem();

    if (selectedVariantText) {
      selectedVariantText.textContent = ITEM.priceFrom ? "Price shown is starting price" : "";
    }
  } catch (err) {
    console.error("Failed to load item:", err);
    window.location.href = `menu.html?stallId=${encodeURIComponent(stallId)}`;
  }
}

/* =========================
   LOAD ADD-ONS
   Add-ons are stall-wide, not per-item.
========================= */
async function loadAddons() {
  selectedAddons.clear();

  try {
    const res = await fetch(`/api/addons/${encodeURIComponent(stallId)}`);
    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);

    ADDONS = await res.json();

    if (!ADDONS.length) {
      hideAddonsUI();
      return;
    }

    renderAddons();
  } catch (err) {
    console.error("Failed to load addons:", err);
    hideAddonsUI();
  }
}

/* =========================
   RENDER
========================= */
function renderItem() {
  itemImg.src = ITEM.img;
  itemImg.alt = ITEM.name;
  itemName.textContent = ITEM.name;
  itemBasePrice.textContent = ITEM.priceFrom ? `from ${money(ITEM.price)}` : money(ITEM.price);
  itemDesc.textContent = ITEM.desc || "";
  updateTotal();
}

function renderAddons() {
  addonsList.innerHTML = "";

  if (!ADDONS.length) {
    addonsList.innerHTML = `<div class="emptyAddons">No add-ons available.</div>`;
    return;
  }

  ADDONS.forEach((a) => {
    const row = document.createElement("label");
    row.className = "addonRow";

    const cb = document.createElement("input");
    cb.type = "checkbox";

    cb.addEventListener("change", () => {
      cb.checked ? selectedAddons.add(a.id) : selectedAddons.delete(a.id);
      updateTotal();
    });

    const text = document.createElement("span");
    text.textContent = a.label;

    const price = document.createElement("span");
    price.className = "addonPrice";
    price.textContent = `+ ${money(a.price)}`;

    row.append(cb, text, price);
    addonsList.appendChild(row);
  });
}

/* =========================
   PRICE CALC
========================= */
function addonsTotal() {
  return ADDONS.reduce(
    (sum, a) => sum + (selectedAddons.has(a.id) ? Number(a.price || 0) : 0),
    0,
  );
}

function unitPrice() {
  return (ITEM?.price || 0) + addonsTotal();
}

function updateTotal() {
  const total = unitPrice() * qty;
  addToCartBtn.textContent = `Add to Cart (${money(total)})`;
}

/* =========================
   QTY
========================= */
qtyMinus?.addEventListener("click", () => {
  qty = Math.max(1, qty - 1);
  qtyVal.textContent = qty;
  updateTotal();
});

qtyPlus?.addEventListener("click", () => {
  qty += 1;
  qtyVal.textContent = qty;
  updateTotal();
});

/* =========================
   ADD TO CART
   CartModel.updateCartItems replaces the ENTIRE cart (deletes all rows
   then reinserts), so "adding" one item means: fetch the current cart,
   append the new item, then send the whole array back.
========================= */
addToCartBtn.addEventListener("click", async () => {
  if (!currentUid) {
    console.warn("Must be logged in to add to cart.");
    // GUESS: adjust to your actual login page/flow if different.
    window.location.href = "login.html";
    return;
  }

  addToCartBtn.disabled = true;

  const newItem = {
    stallId,
    itemId: ITEM.id,
    name: ITEM.name,
    img: ITEM.img,

    qty,
    note: sideNoteEl?.value || "",
    addons: ADDONS.filter((a) => selectedAddons.has(a.id)),

    unitPrice: unitPrice(),
    totalPrice: unitPrice() * qty,
  };

  try {
    // 1. Fetch existing cart items for this user
    let existing = [];
    const getRes = await AuthClient.apiFetch(`/api/cart/${encodeURIComponent(currentUid)}`);
    if (getRes.ok) {
      existing = await getRes.json();
    }

    // 2. Append the new item and send the whole cart back
    const updated = [...existing, newItem];

    const postRes = await AuthClient.apiFetch(`/api/cart/${encodeURIComponent(currentUid)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: updated }),
    });

    if (!postRes.ok) throw new Error(`Request failed with status ${postRes.status}`);

    window.location.href = `menu.html?stallId=${encodeURIComponent(stallId)}`;
  } catch (err) {
    console.error("Failed to add item to cart:", err);
    addToCartBtn.disabled = false;
  }
});

/* =========================
   NAV
========================= */
closeBtn?.addEventListener("click", () => {
  window.location.href = `menu.html?stallId=${encodeURIComponent(stallId)}`;
});

/* Active link highlight */
function markActiveLinks() {
  const current = (
    window.location.pathname.split("/").pop() || "home.html"
  ).toLowerCase();
  document.querySelectorAll(".nav a.pill, #navMobile a.mLink").forEach((a) => {
    const href = (a.getAttribute("href") || "").split("?")[0].toLowerCase();
    a.classList.toggle("active", href === current);
  });
}

/* Hamburger wiring */
function wireHamburger() {
  const menuBtn = document.getElementById("menuBtn");
  const navMobile = document.getElementById("navMobile");
  const navBackdrop = document.getElementById("navBackdrop");

  if (!menuBtn || !navMobile || !navBackdrop) return;

  function openMenu() {
    navMobile.classList.add("open");
    navBackdrop.classList.add("open");
    document.body.classList.add("menuOpen");
    menuBtn.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    navMobile.classList.remove("open");
    navBackdrop.classList.remove("open");
    document.body.classList.remove("menuOpen");
    menuBtn.setAttribute("aria-expanded", "false");
  }

  menuBtn.addEventListener("click", () => {
    navMobile.classList.contains("open") ? closeMenu() : openMenu();
  });

  navBackdrop.addEventListener("click", closeMenu);
  navMobile
    .querySelectorAll("a")
    .forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener(
    "keydown",
    (e) => e.key === "Escape" && closeMenu(),
  );
}

/* =========================
   INIT
========================= */
(async () => {
  wireHamburger();
  markActiveLinks();
  await checkAuthStatus();
  await loadItem();
  await loadAddons();
})();