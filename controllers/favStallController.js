const favStallModel = require("../models/favStallModel");

async function addFavStall(req, res) {
    try{
        const { userId, stallId } = req.body;
        const favStall = await favStallModel.addFavStall(userId, stallId);
        res.status(201).json(favStall);
    } catch (error) {
        console.error("Error adding favorite stall:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function deleteFavStall(req, res) {
    try{
        const { userId, stallId } = req.body;
        const favStall = await favStallModel.deleteFavStall(userId, stallId);
        res.status(200).json(favStall);
    } catch (error) {
        console.error("Error deleting favorite stall:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

module.exports = {
    addFavStall,
    deleteFavStall
};