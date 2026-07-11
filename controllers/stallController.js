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

// GET /api/stalls/:id
async function getStallById(req, res) {
  try {
    const stallId = req.params.id;
    const r = await stallModel.getStallById(stallId);

    if (!r) {
      return res.status(404).json({ error: "Stall not found." });
    }

    res.json({
      id: r.StallId,
      publicStallId: r.PublicStallId || "",
      centreId: r.CentreId,
      stallDocId: r.StallId,
      name: r.StallName,
      cuisine: r.Cuisine || "",
      grade: r.HygieneGrade || "",
      prepMin: r.PrepMin,
      prepMax: r.PrepMax,
      popular: r.IsPopular === true,
      img: r.ImageUrl || "images/stalls/placeholder.jpg",
      desc: r.Desc || "",
      unit: r.UnitNo || "",
      unitNo: r.UnitNo || "",
      rating:
        r.RatingCount > 0
          ? Number((r.RatingTotal / r.RatingCount).toFixed(1))
          : null,
      ratingCount: r.RatingCount ?? 0,
      phone: r.Phone || "",
      openTime: r.OpenTime || "",
      closeTime: r.CloseTime || "",
      operatingHours: r.OperatingHours || "",
    });
  } catch (err) {
    console.error("getStallById error:", err.message);
    res.status(500).json({ error: "Failed to retrieve stall." });
  }
}

module.exports = { getAllStalls, getStallById };
