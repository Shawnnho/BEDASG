// stall-menu.js — MSSQL/Express (no Firebase), cookie auth
// Menu CRUD with single-price OR variant-price (sizes), plus add-ons manager.
// Images stored as base64 data URLs in ImageUrl (no multer).

const API_BASE = "";
const $ = (id) => document.getElementById(id);

/* ===== DOM ===== */
const menuTitle = $("menuTitle");
const statusEl = $("status");
const listEl = $("menuList");
const emptyState = $("emptyState");

/* add modal */
const addModal = $("addMenuModal");
const nameInput = $("menuName");
const priceInput = $("menuPrice");
const catInput = $("menuCategory");
const descInput = $("menuDesc");
const imgInput = $("menuImage");
const imgPreview = $("menuImagePreview");
const addSingleWrap = $("addSingleWrap");
const addVariantWrap = $("addVariantWrap");
const addVariantRows = $("addVariantRows");
const addVariantHint = $("addVariantHint");

/* edit modal */
const editModal = $("editMenuModal");
const editName = $("editName");
const editPrice = $("editPrice");
const editDesc = $("editDesc");
const editImg = $("editImg");
const editCategory = $("editCategory");
const editImgPreview = $("editImgPreview");
const deleteItemBtn = $("deleteItemBtn");
const saveEditBtn = $("saveEditBtn");
const editSingleWrap = $("editSingleWrap");
const editVariantWrap = $("editVariantWrap");
const editVariantRows = $("editVariantRows");
const editVariantHint = $("editVariantHint");

/* addons */
const addonModal = $("addonModal");
const addonListEl = $("addonList");
const addonEmptyEl = $("addonEmpty");
const addonSectionEl = $("addonsSection");

let editingMenuId = null;
let allItems = [];
let knownVariantKeys = [];
let features = { supportsAddons: false, supportsSizePricing: false };

let allAddons = [];
let stallCategories = [];
let editingAddonId = null;

/* ===== helpers ===== */
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(n) {
  const x = Number(n);
  return Number.isFinite(x) ? `$${x.toFixed(2)}` : "—";
}

function prettyVariant(key) {
  return String(key || "")
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function setStatus(msg, isErr = false) {
  if (!statusEl) return;
  statusEl.textContent = msg || "";
  statusEl.style.color = isErr ? "#b00020" : "";
}

function openOverlay(m) {
  if (!m) return;
  m.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeOverlay(m) {
  if (!m) return;
  m.hidden = true;
  document.body.style.overflow = "";
}

function fileToBase64(fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return Promise.resolve(null);
  if (file.size > 1.5 * 1024 * 1024) {
    return Promise.reject(new Error("Image too large (max ~1.5MB)"));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (res.status === 401 || res.status === 403) {
    location.href = "signin.html";
    throw new Error("unauth");
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

/* ===== variant row builders ===== */
function variantRowHtml(key = "", price = "") {
  return `
    <div class="variantRow">
      <input type="text" class="hpModalInput vKey" placeholder="cold_s" value="${esc(key)}" />
      <input type="number" step="0.1" class="hpModalInput vPrice" placeholder="3.00" value="${price === "" ? "" : esc(price)}" />
      <button type="button" class="variantRemove" title="Remove">✕</button>
    </div>`;
}

function addVariantRow(container, key = "", price = "") {
  if (!container) return;
  container.insertAdjacentHTML("beforeend", variantRowHtml(key, price));
}

function readVariants(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(".variantRow"))
    .map((row) => ({
      variantKey: row.querySelector(".vKey")?.value.trim().toLowerCase() || "",
      price: Number(row.querySelector(".vPrice")?.value),
    }))
    .filter((v) => v.variantKey && Number.isFinite(v.price) && v.price >= 0);
}

function renderVariantHint(hintEl, container) {
  if (!hintEl) return;
  if (!knownVariantKeys.length) {
    hintEl.innerHTML = "";
    return;
  }
  hintEl.innerHTML =
    `<span>Common sizes: </span>` +
    knownVariantKeys
      .map(
        (k) =>
          `<span class="variantChip" data-key="${esc(k)}">${esc(k)}</span>`,
      )
      .join("");

  hintEl.querySelectorAll(".variantChip").forEach((chip) => {
    chip.addEventListener("click", () => {
      addVariantRow(container, chip.dataset.key, "");
    });
  });
}

function wirePriceMode(radioName, singleWrap, variantWrap) {
  document.querySelectorAll(`input[name="${radioName}"]`).forEach((r) => {
    r.addEventListener("change", () => {
      if (!r.checked) return;
      const useVariants = r.value === "variants";
      singleWrap.hidden = useVariants;
      variantWrap.hidden = !useVariants;
    });
  });
}

function setPriceMode(radioName, mode) {
  const radio = document.querySelector(
    `input[name="${radioName}"][value="${mode}"]`,
  );
  if (radio) {
    radio.checked = true;
    radio.dispatchEvent(new Event("change"));
  }
}

wirePriceMode("addPriceMode", addSingleWrap, addVariantWrap);
wirePriceMode("editPriceMode", editSingleWrap, editVariantWrap);

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".variantRemove");
  if (!btn) return;
  btn.closest(".variantRow")?.remove();
});

$("addVariantBtn")?.addEventListener("click", () =>
  addVariantRow(addVariantRows),
);
$("editVariantBtn")?.addEventListener("click", () =>
  addVariantRow(editVariantRows),
);

/* ===== feature visibility ===== */
function applyFeatureVisibility() {
  const showSizes = !!features.supportsSizePricing;
  const showAddons = !!features.supportsAddons;

  if (addonSectionEl) addonSectionEl.hidden = !showAddons;

  // Hide the whole "Pricing" row when sizes aren't supported
  document.querySelectorAll(".priceModeRow").forEach((row) => {
    const wrap = row.closest(".hpModalRow");
    if (wrap) wrap.hidden = !showSizes;
  });

  if (!showSizes) {
    if (addVariantWrap) addVariantWrap.hidden = true;
    if (editVariantWrap) editVariantWrap.hidden = true;
    if (addSingleWrap) addSingleWrap.hidden = false;
    if (editSingleWrap) editSingleWrap.hidden = false;
  }
}

/* ===== render menu ===== */
function priceLabel(it) {
  if (it.hasVariants && it.variants.length) {
    const cheapest = Math.min(...it.variants.map((v) => v.price));
    return `from ${money(cheapest)}`;
  }
  return money(it.price);
}

function variantChipsHtml(it) {
  if (!it.hasVariants || !it.variants.length) return "";
  return `
    <div class="menuVariants">
      ${it.variants
        .map(
          (v) =>
            `<span class="prep">${esc(prettyVariant(v.variantKey))} ${money(v.price)}</span>`,
        )
        .join("")}
    </div>`;
}

function renderMenu() {
  if (!listEl) return;

  if (!allItems.length) {
    listEl.innerHTML = "";
    if (emptyState) emptyState.hidden = false;
    return;
  }
  if (emptyState) emptyState.hidden = true;

  listEl.innerHTML = allItems
    .map((it) => {
      const isActive = it.active;
      const img = it.imageUrl || "images/defaultfood.png";
      return `
        <article class="menuItem" data-id="${esc(it.menuId)}" data-active="${isActive ? "1" : "0"}">
          <img class="menuThumb" src="${esc(img)}" alt="${esc(it.name)}"
               onerror="this.src='images/defaultfood.png'" />

          <div class="menuBody">
            <div class="menuItemName">${esc(it.name)}</div>
            ${it.category ? `<div class="menuItemCat">${esc(it.category)}</div>` : ""}
            ${it.description ? `<div class="menuItemDesc">${esc(it.description)}</div>` : ""}

            <div class="menuStatus">
              <span class="prep ${isActive ? "isActive" : "isInactive"}">
                ${isActive ? "Active" : "Inactive"}
              </span>
            </div>

            <div class="menuPriceBlock">
              <div class="menuItemPrice">${priceLabel(it)}</div>
              ${variantChipsHtml(it)}
            </div>
          </div>

          <div class="menuActionRow">
            <button class="menuBtnEdit" data-action="edit">Edit</button>
            <button class="menuBtnToggle" data-action="toggle">${isActive ? "Deactivate" : "Activate"}</button>
            <button class="menuBtnDelete" data-action="delete">Delete</button>
          </div>
        </article>`;
    })
    .join("");
}

/* ===== load menu ===== */
async function loadMenu() {
  try {
    setStatus("Loading menu…");
    const data = await api("/api/stall/menu");

    $("stallName").textContent = data.stallName || "—";
    $("ownerName").textContent = data.ownerName || "Owner";
    if (menuTitle) menuTitle.textContent = `Menu — ${data.stallName || ""}`;

    allItems = Array.isArray(data.items) ? data.items : [];
    knownVariantKeys = Array.isArray(data.variantKeys) ? data.variantKeys : [];
    features = data.features || {
      supportsAddons: false,
      supportsSizePricing: false,
    };

    applyFeatureVisibility();
    renderMenu();
    setStatus("");
  } catch (err) {
    if (err.message === "unauth") return;
    console.error(err);
    setStatus("Failed to load menu.", true);
  }
}

/* ===== add item ===== */
function openAddModal() {
  nameInput.value = "";
  priceInput.value = "";
  if (catInput) catInput.value = "";
  if (descInput) descInput.value = "";
  if (imgInput) imgInput.value = "";
  if (imgPreview) {
    imgPreview.src = "";
    imgPreview.style.display = "none";
  }
  if (addVariantRows) addVariantRows.innerHTML = "";

  setPriceMode("addPriceMode", "single");
  applyFeatureVisibility();
  renderVariantHint(addVariantHint, addVariantRows);

  openOverlay(addModal);
  nameInput?.focus();
}

$("btnAdd")?.addEventListener("click", openAddModal);
$("btnAdd2")?.addEventListener("click", openAddModal);
$("closeAddMenu")?.addEventListener("click", () => closeOverlay(addModal));
$("cancelAddMenu")?.addEventListener("click", () => closeOverlay(addModal));

imgInput?.addEventListener("change", () => {
  const f = imgInput.files?.[0];
  if (!imgPreview) return;
  if (f) {
    imgPreview.src = URL.createObjectURL(f);
    imgPreview.style.display = "block";
  } else {
    imgPreview.style.display = "none";
  }
});

$("saveMenu")?.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) return alert("Please enter item name");

  const useVariants =
    features.supportsSizePricing &&
    document.querySelector('input[name="addPriceMode"]:checked')?.value ===
      "variants";
  const variants = useVariants ? readVariants(addVariantRows) : [];
  const price = Number(priceInput.value);

  if (useVariants) {
    if (!variants.length)
      return alert("Add at least one size with a valid price");
  } else if (!Number.isFinite(price) || price <= 0) {
    return alert("Please enter a valid price");
  }

  try {
    $("saveMenu").disabled = true;
    const imageUrl = (await fileToBase64(imgInput)) || "";
    await api("/api/stall/menu", {
      method: "POST",
      body: JSON.stringify({
        name,
        price: useVariants ? null : price,
        variants,
        category: catInput?.value.trim() || "",
        description: descInput?.value.trim() || "",
        imageUrl,
      }),
    });
    closeOverlay(addModal);
    await loadMenu();
  } catch (err) {
    if (err.message !== "unauth") alert(err.message || "Failed to add item");
  } finally {
    $("saveMenu").disabled = false;
  }
});

/* ===== edit / toggle / delete ===== */
$("closeEditMenu")?.addEventListener("click", () => closeOverlay(editModal));

listEl?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const card = e.target.closest("[data-id]");
  if (!card) return;

  const menuId = card.dataset.id;
  const action = btn.dataset.action;
  const item = allItems.find((i) => i.menuId === menuId);
  if (!item) return;

  if (action === "toggle") {
    try {
      await api(`/api/stall/menu/${encodeURIComponent(menuId)}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ active: !item.active }),
      });
      await loadMenu();
    } catch (err) {
      if (err.message !== "unauth") alert(err.message || "Toggle failed");
    }
  }

  if (action === "delete") {
    if (!confirm("Delete this menu item?")) return;
    try {
      await api(`/api/stall/menu/${encodeURIComponent(menuId)}`, {
        method: "DELETE",
      });
      await loadMenu();
    } catch (err) {
      if (err.message !== "unauth") alert(err.message || "Delete failed");
    }
  }

  if (action === "edit") {
    editingMenuId = menuId;
    editName.value = item.name || "";
    editDesc.value = item.description || "";
    if (editCategory) editCategory.value = item.category || "";
    if (editImg) editImg.value = "";
    if (editImgPreview)
      editImgPreview.src = item.imageUrl || "images/defaultfood.png";

    if (editVariantRows) editVariantRows.innerHTML = "";

    if (item.hasVariants && item.variants.length) {
      setPriceMode("editPriceMode", "variants");
      editPrice.value = "";
      item.variants.forEach((v) =>
        addVariantRow(editVariantRows, v.variantKey, v.price),
      );
    } else {
      setPriceMode("editPriceMode", "single");
      editPrice.value = item.price != null ? String(item.price) : "";
    }

    renderVariantHint(editVariantHint, editVariantRows);

    // Only force-hide the pricing toggle if this stall doesn't do sizes.
    // (Calling it unconditionally would reset a variant item to single mode.)
    if (!features.supportsSizePricing) applyFeatureVisibility();

    openOverlay(editModal);
    editName?.focus();
  }
});

editImg?.addEventListener("change", () => {
  const f = editImg.files?.[0];
  if (editImgPreview && f) editImgPreview.src = URL.createObjectURL(f);
});

saveEditBtn?.addEventListener("click", async () => {
  if (!editingMenuId) return;
  const name = editName.value.trim();
  if (!name) return alert("Please enter item name");

  const useVariants =
    features.supportsSizePricing &&
    document.querySelector('input[name="editPriceMode"]:checked')?.value ===
      "variants";
  const variants = useVariants ? readVariants(editVariantRows) : [];
  const price = Number(editPrice.value);

  if (useVariants) {
    if (!variants.length)
      return alert("Add at least one size with a valid price");
  } else if (!Number.isFinite(price) || price <= 0) {
    return alert("Please enter a valid price");
  }

  try {
    saveEditBtn.disabled = true;
    const item = allItems.find((i) => i.menuId === editingMenuId);
    const b64 = await fileToBase64(editImg);
    const imageUrl = b64 || item?.imageUrl || "";

    await api(`/api/stall/menu/${encodeURIComponent(editingMenuId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        name,
        price: useVariants ? null : price,
        variants,
        category: editCategory?.value.trim() || "",
        description: editDesc.value.trim(),
        imageUrl,
      }),
    });
    closeOverlay(editModal);
    await loadMenu();
  } catch (err) {
    if (err.message !== "unauth") alert(err.message || "Save failed");
  } finally {
    saveEditBtn.disabled = false;
  }
});

deleteItemBtn?.addEventListener("click", async () => {
  if (!editingMenuId) return;
  if (!confirm("Delete this menu item?")) return;
  try {
    await api(`/api/stall/menu/${encodeURIComponent(editingMenuId)}`, {
      method: "DELETE",
    });
    closeOverlay(editModal);
    await loadMenu();
  } catch (err) {
    if (err.message !== "unauth") alert(err.message || "Delete failed");
  }
});

/* ===================== ADD-ONS ===================== */

function ruleText(a) {
  if (!a.ruleType || !a.categories.length) return "Applies to all items";
  const list = a.categories.join(", ");
  return a.ruleType === "allow" ? `Only: ${list}` : `All except: ${list}`;
}

function renderAddons() {
  if (!addonListEl) return;

  if (!allAddons.length) {
    addonListEl.innerHTML = "";
    if (addonEmptyEl) addonEmptyEl.hidden = false;
    return;
  }
  if (addonEmptyEl) addonEmptyEl.hidden = true;

  addonListEl.innerHTML = allAddons
    .map(
      (a) => `
      <div class="addonCard" data-aid="${esc(a.addonId)}" data-active="${a.active ? "1" : "0"}">
        <div class="addonTop">
          <span class="addonName">${esc(a.name)}</span>
          <span class="addonPrice">${a.price > 0 ? money(a.price) : "Free"}</span>
        </div>
        <div class="addonRule">${esc(ruleText(a))}</div>
        <div class="addonActions">
          <button class="addonBtn addonBtnEdit" data-addon-action="edit">Edit</button>
          <button class="addonBtn addonBtnToggle" data-addon-action="toggle">
            ${a.active ? "Deactivate" : "Activate"}
          </button>
        </div>
      </div>`,
    )
    .join("");
}

function renderCatPicker(selected = []) {
  const wrap = $("addonCatList");
  if (!wrap) return;

  if (!stallCategories.length) {
    wrap.innerHTML = `<div class="acctHint">No categories yet — give your menu items a category first.</div>`;
    return;
  }

  wrap.innerHTML = stallCategories
    .map(
      (c) => `
      <label class="addonCatOpt">
        <input type="checkbox" value="${esc(c)}" ${selected.includes(c) ? "checked" : ""} />
        <span>${esc(c)}</span>
      </label>`,
    )
    .join("");
}

$("addonRuleType")?.addEventListener("change", (e) => {
  const wrap = $("addonCatWrap");
  if (wrap) wrap.hidden = !e.target.value;
});

async function loadAddons() {
  try {
    const data = await api("/api/stall/addons");
    allAddons = Array.isArray(data.addons) ? data.addons : [];
    stallCategories = Array.isArray(data.categories) ? data.categories : [];
    renderAddons();
  } catch (err) {
    if (err.message !== "unauth") console.error("loadAddons error:", err);
  }
}

function openAddonModal(addon = null) {
  editingAddonId = addon?.addonId || null;

  $("addonModalTitle").textContent = addon ? "Edit Add-on" : "New Add-on";
  $("addonName").value = addon?.name || "";
  $("addonPrice").value = addon ? String(addon.price) : "";
  $("addonRuleType").value = addon?.ruleType || "";
  $("addonCatWrap").hidden = !addon?.ruleType;
  renderCatPicker(addon?.categories || []);

  $("deleteAddonBtn").style.display = addon ? "" : "none";
  addonModal.querySelector(".hpModalErr").textContent = "";

  openOverlay(addonModal);
  $("addonName").focus();
}

$("btnAddAddon")?.addEventListener("click", () => openAddonModal());
$("closeAddon")?.addEventListener("click", () => closeOverlay(addonModal));

addonListEl?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-addon-action]");
  if (!btn) return;

  const card = e.target.closest("[data-aid]");
  const addonId = card?.dataset.aid;
  const addon = allAddons.find((a) => a.addonId === addonId);
  if (!addon) return;

  if (btn.dataset.addonAction === "edit") {
    openAddonModal(addon);
  }

  if (btn.dataset.addonAction === "toggle") {
    try {
      await api(`/api/stall/addons/${encodeURIComponent(addonId)}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ active: !addon.active }),
      });
      await loadAddons();
    } catch (err) {
      if (err.message !== "unauth") alert(err.message || "Toggle failed");
    }
  }
});

$("saveAddonBtn")?.addEventListener("click", async () => {
  const errEl = addonModal.querySelector(".hpModalErr");
  const name = $("addonName").value.trim();
  const price = Number($("addonPrice").value || 0);
  const ruleType = $("addonRuleType").value || null;

  const categories = Array.from(
    $("addonCatList").querySelectorAll("input:checked"),
  ).map((cb) => cb.value);

  if (!name) {
    errEl.textContent = "Add-on name is required.";
    return;
  }
  if (!Number.isFinite(price) || price < 0) {
    errEl.textContent = "Enter a valid price (0 or more).";
    return;
  }
  if (ruleType && !categories.length) {
    errEl.textContent = "Select at least one category.";
    return;
  }

  const body = JSON.stringify({ name, price, ruleType, categories });

  try {
    $("saveAddonBtn").disabled = true;

    if (editingAddonId) {
      await api(`/api/stall/addons/${encodeURIComponent(editingAddonId)}`, {
        method: "PATCH",
        body,
      });
    } else {
      await api("/api/stall/addons", { method: "POST", body });
    }

    closeOverlay(addonModal);
    await loadAddons();
  } catch (err) {
    if (err.message !== "unauth") errEl.textContent = err.message;
  } finally {
    $("saveAddonBtn").disabled = false;
  }
});

$("deleteAddonBtn")?.addEventListener("click", async () => {
  if (!editingAddonId) return;
  if (!confirm("Delete this add-on?")) return;

  try {
    await api(`/api/stall/addons/${encodeURIComponent(editingAddonId)}`, {
      method: "DELETE",
    });
    closeOverlay(addonModal);
    await loadAddons();
  } catch (err) {
    if (err.message !== "unauth") alert(err.message || "Delete failed");
  }
});

/* ===== logout ===== */
$("logoutBtn")?.addEventListener("click", () => {
  location.href = "signin.html";
});

/* ===== boot ===== */
(async () => {
  await loadMenu();
  if (features.supportsAddons) await loadAddons();
})();
