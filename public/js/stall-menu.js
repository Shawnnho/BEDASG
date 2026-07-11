// stall-menu.js — MSSQL/Express (no Firebase), cookie auth
// Menu CRUD with single-price OR variant-price (sizes) support.
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

let editingMenuId = null;
let allItems = [];
let knownVariantKeys = [];

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

// Pretty-print a variant key: cold_s -> "Cold S", quarter_upper -> "Quarter Upper"
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

// Read the variant rows out of a container into [{ variantKey, price }]
function readVariants(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(".variantRow"))
    .map((row) => ({
      variantKey: row.querySelector(".vKey")?.value.trim().toLowerCase() || "",
      price: Number(row.querySelector(".vPrice")?.value),
    }))
    .filter((v) => v.variantKey && Number.isFinite(v.price) && v.price >= 0);
}

// Render clickable suggestion chips for variant keys this stall already uses
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

// Wire the single/variants radio toggle for a modal
function wirePriceMode(radioName, singleWrap, variantWrap) {
  const radios = document.querySelectorAll(`input[name="${radioName}"]`);
  radios.forEach((r) => {
    r.addEventListener("change", () => {
      const useVariants = r.value === "variants" && r.checked;
      if (r.checked) {
        singleWrap.hidden = useVariants;
        variantWrap.hidden = !useVariants;
      }
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

// Remove-row delegation (works for both modals)
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
    <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px;">
      ${it.variants
        .map(
          (v) =>
            `<span class="prep" style="text-transform:none; font-size:12px;">
               ${esc(prettyVariant(v.variantKey))} ${money(v.price)}
             </span>`,
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
               onerror="this.src='images/defaultfood.png'"
               style="width:100%; height:140px; object-fit:cover; border-radius:12px;" />
          <div style="margin-top:10px;">
            <div style="font-weight:900; font-size:16px;">${esc(it.name)}</div>
            ${it.category ? `<div class="legal-muted" style="font-size:12px;">${esc(it.category)}</div>` : ""}
            ${it.description ? `<div class="legal-muted" style="margin-top:4px;">${esc(it.description)}</div>` : ""}
            <div style="margin-top:6px;">
              <span class="prep ${isActive ? "" : "cancelled"}" style="text-transform:none;">
                ${isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div style="margin-top:10px; font-weight:900;">${priceLabel(it)}</div>
            ${variantChipsHtml(it)}
          </div>
          <div class="menuActionRow" style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="copyBtn" data-action="toggle">${isActive ? "Deactivate" : "Activate"}</button>
            <button class="copyBtn ghostBtn" data-action="edit">Edit</button>
            <button class="copyBtn dangerBtn2" data-action="delete">Delete</button>
          </div>
        </article>`;
    })
    .join("");
}

/* ===== load ===== */
async function loadMenu() {
  try {
    setStatus("Loading menu…");
    const data = await api("/api/stall/menu");

    $("stallName").textContent = data.stallName || "—";
    $("ownerName").textContent = data.ownerName || "Owner";
    if (menuTitle) menuTitle.textContent = `Menu — ${data.stallName || ""}`;

    allItems = Array.isArray(data.items) ? data.items : [];
    knownVariantKeys = Array.isArray(data.variantKeys) ? data.variantKeys : [];
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

    // Populate pricing according to the item's mode
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

/* ===== logout ===== */
$("logoutBtn")?.addEventListener("click", () => {
  location.href = "signin.html";
});

/* ===== boot ===== */
loadMenu();
