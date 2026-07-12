/**************************************
 * menu.js
 * - Loads stall header info (image, name, hygiene grade) from SQL
 *   via GET /api/stalls/:id
 * - Loads menu items, grouped by category, from SQL
 *   via GET /api/menu/:id
 * - Handles nav highlighting + hamburger menu + search filter
 **************************************/
const params = new URLSearchParams(window.location.search);
const stallId = params.get("stallId");

let allMenuItems = []; // cached so the search box can filter without refetching

/**
 * Fetch stall details (image, name, hygiene grade, etc.) from SQL
 * via GET /api/stalls/:id, and populate the stall header on the page.
 */
async function loadStallInfo() {
  const stallIcon = document.getElementById("stallIcon");
  const gradePill = document.getElementById("gradePill");
  const menuTitle = document.getElementById("menuTitle");

  if (!stallId) {
    console.error("Missing stallId in URL");
    if (gradePill) gradePill.textContent = "Stall not found";
    return;
  }

  try {
    const res = await fetch(`/api/stalls/${encodeURIComponent(stallId)}`);

    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }

    const stall = await res.json();

    if (stallIcon) {
      stallIcon.src = stall.img || "images/stalls/placeholder.jpg";
      stallIcon.alt = stall.name || "Stall image";
    }

    if (gradePill) {
      gradePill.textContent = stall.grade
        ? `✓ Hygiene Grade: ${stall.grade}`
        : "Hygiene grade unavailable";
    }

    if (menuTitle) {
      menuTitle.textContent = stall.name ? `${stall.name}'s Menu` : "Menu";
    }
  } catch (err) {
    console.error("Failed to load stall info:", err);
    if (gradePill) gradePill.textContent = "Failed to load hygiene grade";
    if (menuTitle) menuTitle.textContent = "Menu";
  }
}

/**
 * Fetch menu items for this stall from SQL via GET /api/menu/:id,
 * cache them, and render them grouped by category.
 */
async function loadMenuItems() {
  const menuList = document.getElementById("menuList");
  if (!menuList) return;

  if (!stallId) {
    menuList.innerHTML = `<div class="menuEmptyState">Stall not found.</div>`;
    return;
  }

  try {
    const res = await fetch(`/api/menu/${encodeURIComponent(stallId)}`);

    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }

    allMenuItems = await res.json();
    renderMenuItems(allMenuItems);
  } catch (err) {
    console.error("Failed to load menu items:", err);
    menuList.innerHTML = `<div class="menuEmptyState">Failed to load menu items.</div>`;
  }
}

/** Escape user/DB-provided text before inserting into innerHTML. */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/** Format a price, respecting the "from" flag (e.g. "from $7.00"). */
function formatPrice(item) {
  if (item.price == null) return "";
  const amount = `$${Number(item.price).toFixed(2)}`;
  return item.priceFrom ? `from ${amount}` : amount;
}

/**
 * Group items into an ordered Map keyed by category. If any items are
 * flagged popular, a "Popular" group is added first (items still also
 * appear under their own category), matching the reference design.
 */
function groupByCategory(items) {
  const groups = new Map();

  const popularItems = items.filter((i) => i.popular);
  if (popularItems.length > 0) {
    groups.set("Popular", popularItems);
  }

  items.forEach((item) => {
    const category = item.category || "Other";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  });

  return groups;
}

/**
 * Render a single menu item as a <article class="menuCard"> matching
 * the required markup: menuImgWrap > img, menuInfo > menuName/menuPrice/menuLikes,
 * and a sibling menuAddBtn.
 */
function renderMenuItemCard(item, category) {
  return `
    <article class="menuCard" data-item-id="${escapeHtml(item.id)}" data-item-name="${escapeHtml(item.name).toLowerCase()}" data-category="${escapeHtml(category).toLowerCase()}">
      <div class="menuImgWrap">
        <img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.name)}" />
      </div>
      <div class="menuInfo">
        <div class="menuName">${escapeHtml(item.name)}</div>
        <div class="menuPrice">${escapeHtml(formatPrice(item))}</div>
        <div class="menuLikes" role="button" tabindex="0" aria-label="Like ${escapeHtml(item.name)}">
          <span class="likeIcon" aria-hidden="true">♡</span>
          <span class="likeCount">${Number(item.likes) || 0}</span>
        </div>
      </div>
      <button class="menuAddBtn" type="button" aria-label="Add ${escapeHtml(item.name)} to cart">+</button>
    </article>
  `;
}

/**
 * Render all groups as a flat list of siblings inside #menuList:
 * <div class="menuSectionTitle">Category</div>
 * <article class="menuCard">...</article>
 * <article class="menuCard">...</article>
 * <div class="menuSectionTitle">Next category</div>
 * ...
 */
function renderMenuItems(items) {
  const menuList = document.getElementById("menuList");
  if (!menuList) return;

  if (!items || items.length === 0) {
    menuList.innerHTML = `<div class="menuEmptyState">No menu items available yet.</div>`;
    return;
  }

  const groups = groupByCategory(items);

  let html = "";
  groups.forEach((groupItems, category) => {
    html += `<div class="menuSectionTitle">${escapeHtml(category)}</div>`;
    html += groupItems.map((item) => renderMenuItemCard(item, category)).join("");
  });

  menuList.innerHTML = html;
}

/**
 * Filter the already-rendered cards by name as the user types.
 * Since menuCard/menuSectionTitle are flat siblings (no wrapper per
 * category), walk #menuList's children in order and hide a
 * menuSectionTitle if none of the cards following it (up to the next
 * title) match the query.
 */
function wireMenuSearch() {
  const input = document.getElementById("menuQ");
  const menuList = document.getElementById("menuList");
  if (!input || !menuList) return;

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();

    let currentTitleEl = null;
    let currentGroupHasVisible = false;

    Array.from(menuList.children).forEach((el) => {
      if (el.classList.contains("menuSectionTitle")) {
        if (currentTitleEl) {
          currentTitleEl.style.display = currentGroupHasVisible ? "" : "none";
        }
        currentTitleEl = el;
        currentGroupHasVisible = false;
        return;
      }

      if (el.classList.contains("menuCard")) {
        const name = el.dataset.itemName || "";
        const matches = query === "" || name.includes(query);
        el.style.display = matches ? "" : "none";
        if (matches) currentGroupHasVisible = true;
      }
    });

    if (currentTitleEl) {
      currentTitleEl.style.display = currentGroupHasVisible ? "" : "none";
    }
  });
}

/* Add-to-cart and like buttons: rendering only for now.
 * TODO: wire menuAddBtn to a real cart (update #cartCount / #cartCountMobile)
 * and menuLikes to a SQL-backed likes endpoint once those are ready. */
document.addEventListener("click", (e) => {
  const addBtn = e.target.closest(".menuAddBtn");
  if (addBtn) {
    console.warn("Add-to-cart not yet implemented.");
    return;
  }

  const likeEl = e.target.closest(".menuLikes");
  if (likeEl) {
    console.warn("Menu item likes not yet implemented.");
  }
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

document.addEventListener("DOMContentLoaded", () => {
  wireHamburger();
  markActiveLinks();
  wireMenuSearch();
  loadStallInfo();
  loadMenuItems();

  // TODO: Once an auth/session route exists in the SQL backend, re-add
  // role-based visibility for Promotions/Hygiene nav links here
  // (previously done via Firestore user role lookup).
});

/* TODO: Favourite toggling (for the stall itself, not menu items) used to
 * write to Firestore (arrayUnion/arrayRemove on users/{uid}.favourites).
 * Re-implement once there's a SQL/session-based endpoint
 * (e.g. POST /api/users/:id/favourites) to call instead. */
document.addEventListener(
  "click",
  (e) => {
    const heart = e.target.closest(".likeBtn");
    if (!heart) return;

    if (!stallId) {
      console.error("Missing stallId in URL");
      return;
    }

    console.warn(
      "Stall favourite toggling not yet implemented for SQL backend.",
    );
  },
  true,
);