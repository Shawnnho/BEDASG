const favStallModel = require("../models/favStallModel");

async function getFavStalls(req, res) {
  try {
    const userId = req.user.userId;
    const rows = await favStallModel.getFavStalls(userId);
    const favourites = rows.map((r) => r.StallId);
    res.status(200).json({ favourites });
  } catch (error) {
    console.error("Error fetching favourite stalls:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function addFavStall(req, res) {
  try {
    const userId = req.user.userId;
    const { stallId } = req.body;
    const success = await favStallModel.addFavStall(userId, stallId);
    res.status(201).json({ success });
  } catch (error) {
    console.error("Error adding favorite stall:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function deleteFavStall(req, res) {
  try {
    const userId = req.user.userId;
    const { stallId } = req.body;
    const success = await favStallModel.deleteFavStall(userId, stallId);
    res.status(200).json({ success });
  } catch (error) {
    console.error("Error deleting favorite stall:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getFavStalls,
  addFavStall,
  deleteFavStall,
};