const menuPriceModel = require("../models/menuPricesModel");

// GET /api/menuprices/:id -> all variants (name + price) for a specific menu item
async function getItemPrices(req, res) {
  try {
    const menuId = req.params.id;
    if (!menuId) {
      return res.status(400).json({ error: "Invalid menuId" });
    }

    const rows = await menuPriceModel.getItemPrices(menuId);

    // NOTE: field names below are guesses based on stallController's pattern.
    // Adjust the right-hand side (r.XxxYyy) to match your actual
    // StallMenuPrices column names if different.
    const variants = rows.map((r) => ({
      menuId: r.MenuId,
      variant: r.VariantKey,
      price: r.Price
    }));

    res.json(variants);
  } catch (error) {
    console.error("Error fetching menu item variants:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { getItemPrices };