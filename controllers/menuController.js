const menuModel = require("../models/menuModel");

// GET /api/menu/:id  -> menu items for a specific stall
async function getMenuItems(req, res) {
  try {
    const stallId = req.params.id;
    if (!stallId) {
      return res.status(400).json({ error: "Invalid stall ID" });
    }

    const rows = await menuModel.getMenuItems(stallId);

    // NOTE: field names below are guesses based on stallController's pattern
    // and the original (dead) mapping code. Adjust the right-hand side
    // (r.XxxYyy) to match your actual StallMenus column names if different.
    //
    // popular/likes are intentionally NOT set here — StallMenus has no
    // IsPopular/Likes columns, so those would always be false/0. The real
    // like counts come from GET /api/favitems/counts (see menu.js
    // loadLikeCounts), which also derives "popular" from the real count.
    const items = rows.map((r) => ({
      id: r.MenuId ?? r.ItemId ?? r.Id,
      stallId: r.StallId,
      name: r.ItemName || r.Name || "Unnamed item",
      category: r.Category || "Other",
      desc: r.Desc || r.Description || "",
      img: r.ImageUrl || "images/menu/placeholder.jpg",
      price: r.PriceFrom === null ? Number(r.Price) : Number(r.PriceFrom),
    }));

    res.json(items);
  } catch (error) {
    console.error("Error fetching menu items:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { getMenuItems };