const express = require("express");
const router = express.Router();
const favStallController = require("../controllers/favStallController");
const authenticate = require("../middlewares/auth").verifyToken;

// GET /api/favstalls
router.get("/get", authenticate, favStallController.getFavStalls
    // #swagger.tags = ['Favourite Stalls (Customer)']
    // #swagger.summary = 'Get all favourite stalls'
);
router.post("/add", authenticate, favStallController.addFavStall
    // #swagger.tags = ['Favourite Stalls (Customer)']
    // #swagger.summary = 'Add a stall to favourites'
);
router.delete("/delete", authenticate, favStallController.deleteFavStall
    // #swagger.tags = ['Favourite Stalls (Customer)']
    // #swagger.summary = 'Remove a stall from favourites'
);

module.exports = router;