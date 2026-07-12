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

// Normalise the incoming variants array: [{ variantKey, price }, ...]
// Returns { variants, priceFrom } or null if invalid.
function parseVariants(raw) {
  if (!Array.isArray(raw)) return { variants: [], priceFrom: null };

  const variants = [];
  for (const v of raw) {
    const key = String(v?.variantKey || "")
      .trim()
      .toLowerCase();
    const p = num(v?.price);
    if (!key) continue;
    if (!Number.isFinite(p) || p < 0) continue;
    // skip duplicate keys — last one wins
    const existing = variants.findIndex((x) => x.variantKey === key);
    if (existing >= 0) variants[existing] = { variantKey: key, price: p };
    else variants.push({ variantKey: key, price: p });
  }

  const priceFrom = variants.length
    ? Math.min(...variants.map((v) => v.price))
    : null;

  return { variants, priceFrom };
}

/* ===================== MENU ===================== */

// GET /api/stall/menu
async function getMenu(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const stallName = await orderModel.getStallName(user.StallId);
    const features = await menuModel.getStallFeatures(user.StallId);
    const rows = await menuModel.getMenuByStall(user.StallId);

    // Fetch variant prices for all items in one query, then group
    const priceRows = await menuModel.getPricesForMenus(
      rows.map((r) => r.MenuId),
    );
    const byMenu = new Map();
    for (const p of priceRows) {
      if (!byMenu.has(p.MenuId)) byMenu.set(p.MenuId, []);
      byMenu.get(p.MenuId).push({
        variantKey: p.VariantKey,
        price: Number(p.Price),
      });
    }

    const items = rows.map((r) => {
      const variants = byMenu.get(r.MenuId) || [];
      return {
        menuId: r.MenuId,
        name: r.Name,
        description: r.Description || "",
        category: r.Category || "",
        imageUrl: r.ImageUrl || "",
        price: r.Price != null ? Number(r.Price) : null,
        priceFrom: r.PriceFrom != null ? Number(r.PriceFrom) : null,
        variants, // [] means single-price item
        hasVariants: variants.length > 0,
        active: !!r.Active,
        available: !!r.Available,
        createdAt: r.CreatedAt,
      };
    });

    // Distinct variant keys this stall already uses — UI shows as suggestions
    const variantKeys = await menuModel.getVariantKeysByStall(user.StallId);

    res.json({
      stallName: stallName || "—",
      ownerName: user.Name || "Owner",
      items,
      variantKeys,
      features,
    });
  } catch (err) {
    console.error("getMenu error:", err);
    res.status(500).json({ error: "Failed to load menu" });
  }
}

// POST /api/stall/menu
// { name, category?, description?, imageUrl?, price? , variants?: [{variantKey, price}] }
async function createMenu(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const { name, price, category, description, imageUrl, variants } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    const parsed = parseVariants(variants);
    const useVariants = parsed.variants.length > 0;

    let singlePrice = null;
    if (!useVariants) {
      const p = num(price);
      if (!Number.isFinite(p) || p <= 0) {
        return res
          .status(400)
          .json({ error: "Enter a price, or add at least one size" });
      }
      singlePrice = p;
    }

    const menuId = await menuModel.addMenuItem(user.StallId, {
      name: String(name).trim(),
      price: singlePrice, // null when variant-priced
      priceFrom: parsed.priceFrom, // null when single-priced
      category: category || "",
      description: description || "",
      imageUrl: imageUrl || "",
    });

    if (useVariants) {
      await menuModel.replaceMenuPrices(menuId, parsed.variants);
    }

    res.json({ ok: true, menuId });
  } catch (err) {
    console.error("createMenu error:", err);
    res.status(500).json({ error: "Failed to add item" });
  }
}

// PATCH /api/stall/menu/:menuId
async function editMenu(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const { menuId } = req.params;
    const { name, price, category, description, imageUrl, variants } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    const parsed = parseVariants(variants);
    const useVariants = parsed.variants.length > 0;

    let singlePrice = null;
    if (!useVariants) {
      const p = num(price);
      if (!Number.isFinite(p) || p <= 0) {
        return res
          .status(400)
          .json({ error: "Enter a price, or add at least one size" });
      }
      singlePrice = p;
    }

    const affected = await menuModel.updateMenuItem(menuId, user.StallId, {
      name: String(name).trim(),
      price: singlePrice,
      priceFrom: parsed.priceFrom,
      category: category || "",
      description: description || "",
      imageUrl: imageUrl || "",
    });
    if (affected === 0) {
      return res.status(404).json({ error: "Item not found or not yours" });
    }

    // Rewrite the variant set (empty array clears them = switched to single price)
    await menuModel.replaceMenuPrices(menuId, parsed.variants);

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
    // StallMenuPrices rows drop automatically via ON DELETE CASCADE
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

// Collapse the rules rows into a single { ruleType, categories } shape
function shapeRules(rules) {
  if (!rules.length) return { ruleType: null, categories: [] };
  // A given addon uses one rule type in practice; take the first as authoritative
  const ruleType = rules[0].RuleType;
  return {
    ruleType,
    categories: rules
      .filter((r) => r.RuleType === ruleType)
      .map((r) => r.Category),
  };
}

// GET /api/stall/addons
async function getAddons(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const rows = await menuModel.getAddonsByStall(user.StallId);
    const ruleRows = await menuModel.getCategoryRules(
      rows.map((r) => r.AddonId),
    );

    // group rules by addon
    const byAddon = new Map();
    for (const r of ruleRows) {
      if (!byAddon.has(r.AddonId)) byAddon.set(r.AddonId, []);
      byAddon.get(r.AddonId).push(r);
    }

    const addons = rows.map((r) => {
      const { ruleType, categories } = shapeRules(byAddon.get(r.AddonId) || []);
      return {
        addonId: r.AddonId,
        name: r.Name || r.Label || "",
        label: r.Label || r.Name || "",
        price: r.Price != null ? Number(r.Price) : 0,
        active: !!r.Active,
        ruleType, // 'allow' | 'deny' | null (null = applies to everything)
        categories,
        createdAt: r.CreatedAt,
      };
    });

    // All categories this stall uses, for the picker
    const categories = await menuModel.getCategoriesByStall(user.StallId);

    res.json({ addons, categories });
  } catch (err) {
    console.error("getAddons error:", err);
    res.status(500).json({ error: "Failed to load add-ons" });
  }
}

// POST /api/stall/addons  { name, price?, ruleType?, categories? }
async function createAddon(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const { name, price, ruleType, categories } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Add-on name is required" });
    }

    let p = num(price);
    if (!Number.isFinite(p) || p < 0) p = 0;

    if (ruleType && !["allow", "deny"].includes(ruleType)) {
      return res.status(400).json({ error: "Invalid rule type" });
    }
    if (ruleType && (!Array.isArray(categories) || !categories.length)) {
      return res
        .status(400)
        .json({ error: "Select at least one category for this rule" });
    }

    const addonId = await menuModel.addAddon(user.StallId, {
      name: String(name).trim(),
      label: String(name).trim(),
      price: p,
    });

    await menuModel.replaceCategoryRules(
      addonId,
      ruleType || null,
      categories || [],
    );

    res.json({ ok: true, addonId });
  } catch (err) {
    console.error("createAddon error:", err);
    res.status(500).json({ error: "Failed to add add-on" });
  }
}

// PATCH /api/stall/addons/:addonId
async function editAddon(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const { addonId } = req.params;
    const { name, price, ruleType, categories } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Add-on name is required" });
    }

    let p = num(price);
    if (!Number.isFinite(p) || p < 0) p = 0;

    if (ruleType && !["allow", "deny"].includes(ruleType)) {
      return res.status(400).json({ error: "Invalid rule type" });
    }
    if (ruleType && (!Array.isArray(categories) || !categories.length)) {
      return res
        .status(400)
        .json({ error: "Select at least one category for this rule" });
    }

    const affected = await menuModel.updateAddon(addonId, user.StallId, {
      name: String(name).trim(),
      label: String(name).trim(),
      price: p,
    });
    if (affected === 0) {
      return res.status(404).json({ error: "Add-on not found or not yours" });
    }

    await menuModel.replaceCategoryRules(
      addonId,
      ruleType || null,
      categories || [],
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("editAddon error:", err);
    res.status(500).json({ error: "Failed to update add-on" });
  }
}

// PATCH /api/stall/addons/:addonId/toggle  { active }
async function toggleAddon(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const { addonId } = req.params;
    const { active } = req.body;

    const affected = await menuModel.toggleAddonActive(
      addonId,
      user.StallId,
      !!active,
    );
    if (affected === 0) {
      return res.status(404).json({ error: "Add-on not found or not yours" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("toggleAddon error:", err);
    res.status(500).json({ error: "Failed to toggle add-on" });
  }
}

// DELETE /api/stall/addons/:addonId
async function removeAddon(req, res) {
  try {
    const user = await resolveStall(req, res);
    if (!user) return;

    const { addonId } = req.params;
    // StallAddonCategories rows drop via ON DELETE CASCADE
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

module.exports = {
  getMenu,
  createMenu,
  editMenu,
  toggleMenu,
  removeMenu,
  getAddons,
  createAddon,
  editAddon,
  toggleAddon,
  removeAddon,
};
