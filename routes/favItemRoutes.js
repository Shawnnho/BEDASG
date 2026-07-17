const express = require("express");
const router = express.Router();
const favItemController = require("../controllers/favItemController");
const authenticate = require("../middlewares/auth").verifyToken;

router.get("/get", authenticate, favItemController.getFavouriteItems);
router.post("/add", authenticate, favItemController.createFavouriteItem);
router.delete("/delete", authenticate, favItemController.deleteFavouriteItem);
router.get("/counts", favItemController.getFavouriteCounts);

module.exports = router;