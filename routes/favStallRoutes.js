const express = require("express");
const router = express.Router();
const favStallController = require("../controllers/favStallController");
const authenticate = require("../middlewares/auth").verifyToken;

// GET /api/favstalls
router.get("/get", authenticate, favStallController.getFavStalls);
router.post("/add", authenticate, favStallController.addFavStall);
router.delete("/delete", authenticate, favStallController.deleteFavStall);

module.exports = router;