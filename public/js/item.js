/*************************************************
 * item.js (SQL version)
 * - Loads the menu item's details via GET /api/menu/:stallId
 *   (no single-item endpoint exists yet, so we fetch the stall's
 *   full menu and find the matching item client-side)
 * - Loads this item's variants (name + price) via
 *   GET /api/menuprices/:itemId
 * - Loads stall-wide add-ons via GET /api/addons/:stallId
 *   (add-ons are NOT per-item - every active add-on for the stall applies)
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
const variantsList = document.getElementById("variantsList");
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
let VARIANTS = [];
let selectedVariant = null; // { menuId, variant, price } or null
let qty = 1;
let currentUid = null;
let STALL_CAPS = { addons: false, sizing: false }; // from GET /api/stalls/:id (SupportsAddons / SupportsSizePricing)
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

/** Convert a raw variant key like "cold_s" into a display label "Cold S". */
function formatVariantLabel(variant) {
  return String(variant || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Update the "<Item Name> (<variant>)" heading to reflect the current selection. */
function updateItemNameDisplay() {
  if (!itemName || !ITEM) return;
  itemName.textContent = selectedVariant
    ? `${ITEM.name} (${formatVariantLabel(selectedVariant.variant)})`
    : ITEM.name;
}

function hideAddonsUI() {
  const section = document.getElementById("addonsSection");
  if (section) section.style.display = "none";
}

function hideVariantsUI() {
  const section = document.getElementById("variantsSection");
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
  } catch (err) {
    console.error("Failed to load item:", err);
    window.location.href = `menu.html?stallId=${encodeURIComponent(stallId)}`;
  }
}

/**
 * Fetch this stall's capability flags (SupportsAddons / SupportsSizePricing)
 * via GET /api/stalls/:stallId. These come back as 0/1 (or boolean, depending
 * on the SQL driver) - Boolean(...) normalizes either case.
 */
async function loadStallCapabilities() {
  try {
    const res = await fetch(`/api/stalls/${encodeURIComponent(stallId)}`);
    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);

    const stall = await res.json();
    STALL_CAPS = {
      addons: Boolean(stall.addons),
      sizing: Boolean(stall.sizing),
    };
  } catch (err) {
    console.error("Failed to load stall capabilities:", err);
    // Fail safe: assume neither is supported rather than showing broken sections
    STALL_CAPS = { addons: false, sizing: false };
  }
}

/* =========================
   LOAD VARIANTS
   Per-item options (e.g. sizes), each with its own price.
   Only called if STALL_CAPS.sizing is true.
   If none exist, the base item price from /api/menu/:stallId is used.
========================= */
async function loadVariants() {
  if (!variantsList) return;

  try {
    const res = await fetch(`/api/menuprices/${encodeURIComponent(itemId)}`);
    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);

    VARIANTS = await res.json();

    if (!VARIANTS.length) {
      hideVariantsUI();
      return;
    }

    renderVariants();
  } catch (err) {
    console.error("Failed to load variants:", err);
    hideVariantsUI();
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
  updateItemNameDisplay();
  itemBasePrice.textContent = ITEM.priceFrom ? `from ${money(ITEM.price)}` : money(ITEM.price);
  itemDesc.textContent = ITEM.desc || "";
  updateTotal();
}

/**
 * Render each variant as a radio button (mutually exclusive, like
 * choosing a size). Auto-selects the first/cheapest variant so the
 * displayed total is always accurate as soon as variants load.
 */
function renderVariants() {
  if (!variantsList) return;
  variantsList.innerHTML = "";

  const sorted = [...VARIANTS].sort((a, b) => Number(a.price) - Number(b.price));

  sorted.forEach((v, index) => {
    const row = document.createElement("label");
    row.className = "variantRow";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "itemVariant";
    radio.value = v.variant;
    radio.checked = index === 0; // default to the first (cheapest) option

    radio.addEventListener("change", () => {
      if (radio.checked) {
        selectedVariant = v;
        updateSelectedVariantText();
        updateItemNameDisplay();
        updateTotal();
      }
    });

    const text = document.createElement("span");
    text.textContent = formatVariantLabel(v.variant);

    const price = document.createElement("span");
    price.className = "variantPrice";
    price.textContent = money(v.price);

    row.append(radio, text, price);
    variantsList.appendChild(row);
  });

  // Auto-select the first variant so pricing/cart-add works immediately
  selectedVariant = sorted[0] || null;
  updateSelectedVariantText();
  updateItemNameDisplay();
}

function updateSelectedVariantText() {
  if (!selectedVariantText) return;
  selectedVariantText.textContent = selectedVariant
    ? selectedVariant.variant
    : ITEM?.priceFrom
      ? "Price shown is starting price"
      : "";
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

/**
 * If this item has variants, the selected variant's price REPLACES the
 * base item price (e.g. "Small $3 / Large $5" - not stacked on top of
 * the base price). If there are no variants, fall back to ITEM.price.
 */
function unitPrice() {
  const base = selectedVariant ? Number(selectedVariant.price) : (ITEM?.price || 0);
  return base + addonsTotal();
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

  if (VARIANTS.length > 0 && !selectedVariant) {
    console.warn("Please select an option before adding to cart.");
    return;
  }

  addToCartBtn.disabled = true;

  const newItem = {
    stallId,
    itemId: ITEM.id,
    name: ITEM.name,
    img: ITEM.img,

    variantKey: selectedVariant ? selectedVariant.variant : null,

    qty,
    note: sideNoteEl?.value || "",
    addons: ADDONS.filter((a) => selectedAddons.has(a.id)),

    unitPrice: unitPrice(),
    totalPrice: unitPrice() * qty,
  };

try {
    const postRes = await AuthClient.apiFetch(`/api/cart/${encodeURIComponent(currentUid)}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem),
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
  await loadStallCapabilities();

  if (STALL_CAPS.sizing) {
    await loadVariants();
  } else {
    hideVariantsUI();
  }

  if (STALL_CAPS.addons) {
    await loadAddons();
  } else {
    hideAddonsUI();
  }
})();