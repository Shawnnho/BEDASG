/**************************************
 * menu.js
 * - Loads stall header info (image, name, hygiene grade) from SQL
 *   via GET /api/stalls/:id
 * - Loads menu items, grouped by category, from SQL
 *   via GET /api/menu/:id
 * - Handles nav highlighting + hamburger menu + search filter
 * - Handles per-item favourite ("like") toggling
 * - "+" button navigates to item.html for that menu item
 *
 * NOTE: markup/classnames here (menuCard, menuImgWrap, menuInfo,
 * menuName, menuPrice, menuLikes, likeBtn, likeCount, menuAddBtn)
 * are matched to the MENU PAGE section of styles.css.
 **************************************/
const params = new URLSearchParams(window.location.search);
const stallId = params.get("stallId");


let allMenuItems = []; // cached so the search box can filter without refetching
let currentUid = null;
let favItemsSet = new Set(); // ids of menu items the current user has liked

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
    loadLikeCounts();
  } catch (err) {
    console.error("Failed to load menu items:", err);
    menuList.innerHTML = `<div class="menuEmptyState">Failed to load menu items.</div>`;
  }
}

/**
 * Fetch real like counts (across all users) for every menu item
 * currently loaded, merge them into allMenuItems, and re-render.
 * Public endpoint - doesn't require the viewer to be logged in.
 */
async function loadLikeCounts() {
  if (!allMenuItems || allMenuItems.length === 0) return;

  const menuIds = allMenuItems.map((item) => item.id);

  try {
    const res = await fetch(`/api/favitems/counts?menuIds=${encodeURIComponent(menuIds.join(","))}`);
    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);

    const rows = await res.json(); // [{ MenuId, LikeCount }, ...] - items with 0 likes are omitted
    const countsByMenuId = new Map(rows.map((row) => [row.MenuId, row.LikeCount]));

    allMenuItems.forEach((item) => {
      item.likes = countsByMenuId.get(item.id) || 0;
      // No backend "popular" flag exists — the real like count is the only
      // signal we have, so derive it here instead of always showing empty.
      item.popular = item.likes > 0;
    });

    renderMenuItems(allMenuItems);
  } catch (err) {
    console.error("Failed to load like counts:", err);
    // Non-fatal: cards just keep whatever "likes" value came from /api/menu/:id (if any)
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
 * Render a single menu item as <article class="menuCard">, matching
 * styles.css exactly: menuImgWrap > img, menuInfo > menuName/menuPrice/
 * menuLikes (likeBtn + likeCount), and a sibling menuAddBtn.
 */
function renderMenuItemCard(item, category) {
  const favOn = favItemsSet.has(item.id);

  return `
    <article class="menuCard" data-item-id="${escapeHtml(item.id)}" data-item-name="${escapeHtml(item.name).toLowerCase()}" data-category="${escapeHtml(category).toLowerCase()}">
      <div class="menuImgWrap">
        <img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.name)}" />
      </div>
      <div class="menuInfo">
        <div class="menuName">${escapeHtml(item.name)}</div>
        <div class="menuPrice">${escapeHtml(formatPrice(item))}</div>
        <div class="menuLikes">
          <button
            class="likeBtn${favOn ? " active" : ""}"
            type="button"
            data-item="${escapeHtml(item.id)}"
            aria-label="Like ${escapeHtml(item.name)}"
          >
            <img
              class="heartIcon"
              alt=""
              aria-hidden="true"
              src="${favOn ? "images/heart.png" : "images/like.png"}"
            />
          </button>
          <span class="likeCount">${Number(item.likes) || 0}</span>
        </div>
      </div>
      <button class="menuAddBtn" type="button" aria-label="View ${escapeHtml(item.name)}">+</button>
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

/**
 * Load the current user's liked menu items and re-render so likeBtn
 * "active" state + likeCount reflect it. Mirrors home.js's loadFavourites().
 *
 * Backend returns raw rows: [{ UserId, MenuId, CreatedAt }, ...]
 * (not { favourites: [...] }), so we map MenuId out of each row.
 */
async function loadFavouriteItems() {
  if (!currentUid) return;

  try {
    const url = `/api/favitems/get?userId=${encodeURIComponent(currentUid)}`;
    const res = await AuthClient.apiFetch(url);
    if (res.ok) {
      const rows = await res.json();
      favItemsSet = new Set(rows.map((row) => row.MenuId));
      renderMenuItems(allMenuItems);
    }
  } catch (err) {
    console.error("Failed to load favourite items:", err);
  }
}

/**
 * Toggle a menu item's liked state, with optimistic UI update and
 * rollback on failure. Mirrors home.js's toggleFavourite().
 *
 * Backend expects userId + menuId as query params on both
 * POST /api/favitems/add and DELETE /api/favitems/delete (no JSON body).
 */
async function toggleFavouriteItem(itemId) {
  if (!currentUid) return;

  const isFav = favItemsSet.has(itemId);
  const item = allMenuItems.find((i) => i.id === itemId);

  // Optimistic UI update - toggle liked state and adjust the visible count
  if (isFav) favItemsSet.delete(itemId);
  else favItemsSet.add(itemId);
  if (item) {
    item.likes = Math.max(0, (Number(item.likes) || 0) + (isFav ? -1 : 1));
  }
  renderMenuItems(allMenuItems);

  try {
    const baseUrl = isFav ? "/api/favitems/delete" : "/api/favitems/add";
    const url = `${baseUrl}?userId=${encodeURIComponent(currentUid)}&menuId=${encodeURIComponent(itemId)}`;
    const res = await AuthClient.apiFetch(url, {
      method: isFav ? "DELETE" : "POST",
    });

    if (!res.ok) throw new Error("Failed to save");
  } catch (err) {
    console.error("Error toggling favourite item:", err);
    // Revert both the liked state and the count on failure
    if (isFav) favItemsSet.add(itemId);
    else favItemsSet.delete(itemId);
    if (item) {
      item.likes = Math.max(0, (Number(item.likes) || 0) + (isFav ? 1 : -1));
    }
    renderMenuItems(allMenuItems);
  }
}

/**
 * Check auth status via AuthClient (same helper home.js uses) and load
 * this user's favourite menu items if logged in.
 */
async function checkAuthStatus() {
  const user = await AuthClient.getCurrentUser();

  if (user) {
    currentUid = user.id;
    loadFavouriteItems();
  } else {
    currentUid = null;
    favItemsSet = new Set();
  }
}

/* "+" button (view item) and like button clicks. */
document.addEventListener("click", (e) => {
  const addBtn = e.target.closest(".menuAddBtn");
  if (addBtn) {
    const card = addBtn.closest(".menuCard");
    const itemId = card?.dataset.itemId;
    if (!itemId || !stallId) return;

    window.location.href = `item.html?stallid=${encodeURIComponent(stallId)}&itemid=${encodeURIComponent(itemId)}`;
    return;
  }

  const likeBtn = e.target.closest(".likeBtn");
  if (likeBtn) {
    const itemId = likeBtn.getAttribute("data-item");
    if (!itemId) return;

    if (!currentUid) {
      console.warn("Must be logged in to like a menu item.");
      return;
    }

    toggleFavouriteItem(itemId);
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
  checkAuthStatus();

  // TODO: Once an auth/session route exists in the SQL backend, re-add
  // role-based visibility for Promotions/Hygiene nav links here
  // (previously done via Firestore user role lookup).
});