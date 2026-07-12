const addonModel = require("../models/addonModel");

// GET /api/addons/:id  -> active add-ons for a specific stall
async function getAddonsByStall(req, res) {
  try {
    const stallId = req.params.id;
    if (!stallId) {
      return res.status(400).json({ error: "Invalid stall ID" });
    }

    const rows = await addonModel.getAddonsByStall(stallId);

    // NOTE: Price isn't in the current model's SELECT — add it to
    // addonModel.js's query, then uncomment/add the price field below.
    const addons = rows
      .filter((r) => r.Active === true || r.Active === 1)
      .map((r) => ({
        id: r.AddonId,
        stallId: r.StallId,
        label: r.Label,
        price: r.Price != null ? Number(r.Price) : null,
      }));

    res.json(addons);
  } catch (error) {
    console.error("Error fetching addons:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { getAddonsByStall };