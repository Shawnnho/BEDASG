const stallModel = require("../models/stallModel");

// GET /api/stalls
async function getAllStalls(req, res) {
  try {
    const rows = await stallModel.getAllStalls();

    const stalls = rows.map((r) => ({
      id: r.StallId,
      centreId: r.CentreId,
      stallDocId: r.StallId,
      name: r.StallName,
      cuisine: r.Cuisine || "",
      grade: r.HygieneGrade || "B",
      prepMin: r.PrepMin ?? 5,
      prepMax: r.PrepMax ?? 10,
      popular: r.IsPopular === true,
      img: r.ImageUrl || "images/stalls/placeholder.jpg",
      desc: r.Desc || "",
      unit: r.UnitNo || "",
      addons: r.SupportsAddons,
      sizing: r.SupportsSizePricing,
    }));

    res.json(stalls);
  } catch (err) {
    console.error("getAllStalls error:", err.message);
    res.status(500).json({ error: "Failed to retrieve stalls." });
  }
}

// GET /api/stalls/:id
async function getStallById(req, res) {
  try {
    const stallId = req.params.id;
    console.log("=== getStallById ===");
    console.log("received:", JSON.stringify(stallId));
    console.log("length:", stallId.length);
    console.log(
      "char codes:",
      [...stallId].map((c) => c.charCodeAt(0)).join(","),
    );

    const row = await stallModel.getStallById(stallId);
    console.log("row found:", !!row);

    if (!row) {
      return res.status(404).json({ error: "Stall not found." });
    }

    const stall = {
      id: row.StallId,
      publicStallId: row.PublicStallId || "",
      centreId: row.CentreId,
      stallDocId: row.StallId,
      name: row.StallName,
      cuisine: row.Cuisine || "",
      grade: row.HygieneGrade || "",
      prepMin: row.PrepMin,
      prepMax: row.PrepMax,
      popular: row.IsPopular === true,
      desc: row.Desc || "",
      img: row.ImageUrl || "images/stalls/placeholder.jpg",
      unit: (row.UnitNo || "").replace("#", ""),
      unitNo: row.UnitNo || "", // Kept both unit and unitNo in case different frontend components rely on them
      rating:
        row.RatingCount > 0
          ? Number((row.RatingTotal / row.RatingCount).toFixed(1))
          : null,
      ratingCount: row.RatingCount ?? 0,
      ratingTotal: row.RatingTotal ?? 0,
      phone: row.Phone || "",
      openTime: row.OpenTime || "",
      closeTime: row.CloseTime || "",
      operatingHours: row.OperatingHours || null,
      addons: row.SupportsAddons,
      sizing: row.SupportsSizePricing,
    };

    res.json(stall);
  } catch (err) {
    console.error("getStallById error:", err.message);
    res.status(500).json({ error: "Failed to retrieve stall." });
  }
}

module.exports = { getAllStalls, getStallById };
