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
    }));

    res.json(stalls);
  } catch (err) {
    console.error("getAllStalls error:", err.message);
    res.status(500).json({ error: "Failed to retrieve stalls." });
  }
}

async function getStallById(req, res) {
  try {
    const stallId = req.params.id;
    const row = await stallModel.getStallById(stallId);
    if (!row) {
      return res.status(404).json({ error: "Stall not found." });
    }

    const stall = {
      id: row.StallId,
      centreId: row.CentreId,
      name: row.StallName,
      cuisine: row.Cuisine || "",
      grade: row.HygieneGrade || "",
      desc: row.Desc || "",
      img: row.ImageUrl || "images/stalls/placeholder.jpg",
      unit: row.UnitNo || "",
      ratingCount: row.RatingCount ?? 0,
      phone: row.Phone || "",
      openTime: row.OpenTime || "",
      closeTime: row.CloseTime || "",
      operatingHours: row.OperatingHours || null,
    };
    res.json(stall);
  } catch (err) {
    console.error("getStallById error:", err.message);
    res.status(500).json({ error: "Failed to retrieve stall." });
  }
}

module.exports = { getAllStalls, getStallById };
