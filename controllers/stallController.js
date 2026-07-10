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
  const stallId = req.params.id;
  const stall = row.map((r) => ({
    id: r.StallId,
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
    rating: r.RatingAvg,
    phone: r.Phone || "",
    openTime: r.OpenTime || "",
    closeTime: r.CloseTime || "",
    unitNo: r.UnitNo || "",
  })
)
}

module.exports = { getAllStalls };
