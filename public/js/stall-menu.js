// stall-menu.js — MSSQL/Express (no Firebase), cookie auth
// Core menu CRUD + separate stall add-ons manager.
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

let editingMenuId = null;
let allItems = [];

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

// Read a chosen file into a base64 data URL (or null if none). Caps size.
function fileToBase64(fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return Promise.resolve(null);
  if (file.size > 1.5 * 1024 * 1024) {
    return Promise.reject(new Error("Image too large (max ~1.5MB)"));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // "data:image/...;base64,..."
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

/* ===== render menu ===== */
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
            <div style="margin-top:10px; font-weight:900;">${money(it.price)}</div>
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
  openOverlay(addModal);
  nameInput?.focus();
}

$("btnAdd")?.addEventListener("click", openAddModal);
$("btnAdd2")?.addEventListener("click", openAddModal);
$("closeAddMenu")?.addEventListener("click", () => closeOverlay(addModal));
$("cancelAddMenu")?.addEventListener("click", () => closeOverlay(addModal));

// live preview (add)
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
  const price = Number(priceInput.value);
  if (!name) return alert("Please enter item name");
  if (!Number.isFinite(price) || price <= 0)
    return alert("Please enter a valid price");

  try {
    $("saveMenu").disabled = true;
    const imageUrl = (await fileToBase64(imgInput)) || "";
    await api("/api/stall/menu", {
      method: "POST",
      body: JSON.stringify({
        name,
        price,
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

/* ===== edit / toggle / delete (event delegation) ===== */
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
    editPrice.value = item.price != null ? String(item.price) : "";
    if (editCategory) editCategory.value = item.category || "";
    if (editImg) editImg.value = "";
    if (editImgPreview)
      editImgPreview.src = item.imageUrl || "images/defaultfood.png";
    openOverlay(editModal);
    editName?.focus();
  }
});

// live preview (edit)
editImg?.addEventListener("change", () => {
  const f = editImg.files?.[0];
  if (editImgPreview && f) editImgPreview.src = URL.createObjectURL(f);
});

saveEditBtn?.addEventListener("click", async () => {
  if (!editingMenuId) return;
  const name = editName.value.trim();
  const price = Number(editPrice.value);
  if (!name) return alert("Please enter item name");
  if (!Number.isFinite(price) || price <= 0)
    return alert("Please enter a valid price");

  try {
    saveEditBtn.disabled = true;
    const item = allItems.find((i) => i.menuId === editingMenuId);
    const b64 = await fileToBase64(editImg);
    const imageUrl = b64 || item?.imageUrl || "";
    await api(`/api/stall/menu/${encodeURIComponent(editingMenuId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        name,
        price,
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
