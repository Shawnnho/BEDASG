const centreModel = require("../models/centreModel");

async function getCentres(req, res) {
  try {
    const centres = await centreModel.getAllCentres();
    const data = centres.map((c) => ({
      centreId: c.CentreId,
      name: c.Name || c.CentreId,
      imageUrl: c.ImagePath || "images/default-centre.jpg",
    }));
    res.json(data);
  } catch (err) {
    console.error("Error fetching centres:", err);
    res.status(500).json({ error: "Failed to load centres" });
  }
}

async function getCentre(req, res) {
  try {
    const centre = await centreModel.getCentreById(req.params.id);
    if (!centre) return res.status(404).json({ error: "Centre not found" });
    res.json(centre);
  } catch (err) {
    console.error("Error fetching centre:", err);
    res.status(500).json({ error: "Failed to load centre" });
  }
}

module.exports = { getCentres, getCentre };
