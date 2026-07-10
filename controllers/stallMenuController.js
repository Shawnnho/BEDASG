const menuModel = require("../models/stallMenuModel");
const orderModel = require("../models/orderModel"); // reuse getUserInfo


// Resolve the logged-in owner's stall (and name) from the JWT cookie
async function resolveStall(req, res) {
  const userId = req.user?.UserId || req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const user = await orderModel.getUserInfo(userId);
  if (!user?.StallId) {
    res.status(404).json({ error: "No stall linked to this user" });
    return null;
  }
  return user; // { StallId, Name }
}

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : NaN;
}

/* ===================== MENU ===================== */

// GET /api/stall/menu
async function getMenu(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const stallName = await orderModel.getStallName(user.StallId);
    const rows = await menuModel.getMenuByStall(user.StallId);

    const items = rows.map((r) => ({
      menuId: r.MenuId,
      name: r.Name,
      description: r.Description || "",
      category: r.Category || "",
      imageUrl: r.ImageUrl || "",
      price: r.Price != null ? Number(r.Price) : null,
      priceFrom: r.PriceFrom != null ? Number(r.PriceFrom) : null,
      active: !!r.Active,
      available: !!r.Available,
      createdAt: r.CreatedAt,
    }));

    res.json({
      stallName: stallName || "—",
      ownerName: user.Name || "Owner",
      items,
    });
  } catch (err) {
    console.error("getMenu error:", err);
    res.status(500).json({ error: "Failed to load menu" });
  }
}

// POST /api/stall/menu  { name, price, category?, description?, imageUrl? }
async function createMenu(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const { name, price, category, description, imageUrl } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    const p = num(price);
    if (!Number.isFinite(p) || p <= 0) {
      return res.status(400).json({ error: "Valid price is required" });
    }

    const menuId = await menuModel.addMenuItem(user.StallId, {
      name: String(name).trim(),
      price: p,
      category: category || "",
      description: description || "",
      imageUrl: imageUrl || "",
    });
    res.json({ ok: true, menuId });
  } catch (err) {
    console.error("createMenu error:", err);
    res.status(500).json({ error: "Failed to add item" });
  }
}

// PATCH /api/stall/menu/:menuId  { name, price, category?, description?, imageUrl? }
async function editMenu(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const { menuId } = req.params;
    const { name, price, category, description, imageUrl } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    const p = num(price);
    if (!Number.isFinite(p) || p <= 0) {
      return res.status(400).json({ error: "Valid price is required" });
    }

    const affected = await menuModel.updateMenuItem(menuId, user.StallId, {
      name: String(name).trim(),
      price: p,
      category: category || "",
      description: description || "",
      imageUrl: imageUrl || "",
    });
    if (affected === 0) {
      return res.status(404).json({ error: "Item not found or not yours" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("editMenu error:", err);
    res.status(500).json({ error: "Failed to update item" });
  }
}

// PATCH /api/stall/menu/:menuId/toggle  { active }
async function toggleMenu(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const { menuId } = req.params;
    const { active } = req.body;

    const affected = await menuModel.toggleMenuActive(
      menuId,
      user.StallId,
      !!active,
    );
    if (affected === 0) {
      return res.status(404).json({ error: "Item not found or not yours" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("toggleMenu error:", err);
    res.status(500).json({ error: "Failed to toggle item" });
  }
}

// DELETE /api/stall/menu/:menuId
async function removeMenu(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const { menuId } = req.params;
    const affected = await menuModel.deleteMenuItem(menuId, user.StallId);
    if (affected === 0) {
      return res.status(404).json({ error: "Item not found or not yours" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("removeMenu error:", err);
    res.status(500).json({ error: "Failed to delete item" });
  }
}

/* ===================== ADD-ONS ===================== */

// GET /api/stall/addons
async function getAddons(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const rows = await menuModel.getAddonsByStall(user.StallId);
    const addons = rows.map((r) => ({
      addonId: r.AddonId,
      name: r.Name,
      price: r.Price != null ? Number(r.Price) : 0,
      active: !!r.Active,
      createdAt: r.CreatedAt,
    }));
    res.json({ addons });
  } catch (err) {
    console.error("getAddons error:", err);
    res.status(500).json({ error: "Failed to load add-ons" });
  }
}

// POST /api/stall/addons  { name, price? }
async function createAddon(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const { name, price } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Add-on name is required" });
    }
    let p = num(price);
    if (!Number.isFinite(p) || p < 0) p = 0;

    const addonId = await menuModel.addAddon(user.StallId, {
      name: String(name).trim(),
      price: p,
    });
    res.json({ ok: true, addonId });
  } catch (err) {
    console.error("createAddon error:", err);
    res.status(500).json({ error: "Failed to add add-on" });
  }
}

// PATCH /api/stall/addons/:addonId  { name, price? }
async function editAddon(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const { addonId } = req.params;
    const { name, price } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Add-on name is required" });
    }
    let p = num(price);
    if (!Number.isFinite(p) || p < 0) p = 0;

    const affected = await menuModel.updateAddon(addonId, user.StallId, {
      name: String(name).trim(),
      price: p,
    });
    if (affected === 0) {
      return res.status(404).json({ error: "Add-on not found or not yours" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("editAddon error:", err);
    res.status(500).json({ error: "Failed to update add-on" });
  }
}

// DELETE /api/stall/addons/:addonId
async function removeAddon(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const { addonId } = req.params;
    const affected = await menuModel.deleteAddon(addonId, user.StallId);
    if (affected === 0) {
      return res.status(404).json({ error: "Add-on not found or not yours" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("removeAddon error:", err);
    res.status(500).json({ error: "Failed to delete add-on" });
  }
}

// POST /api/stall/upload  (multipart, field name: "image")
async function uploadImage(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    // Public path the browser can use
    const url = `images/uploads/${req.file.filename}`;
    res.json({ ok: true, url });
  } catch (err) {
    console.error("uploadImage error:", err);
    res.status(500).json({ error: "Failed to upload image" });
  }
}
module.exports = {
  getMenu,
  createMenu,
  editMenu,
  toggleMenu,
  removeMenu,
  getAddons,
  createAddon,
  editAddon,
  removeAddon,
  uploadImage,
};
