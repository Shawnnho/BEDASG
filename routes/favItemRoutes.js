const express = require("express");
const router = express.Router();
const favItemController = require("../controllers/favItemController");
const authenticate = require("../middlewares/auth").verifyToken;

router.get("/get", authenticate, favItemController.getFavouriteItems
    // #swagger.tags = ['Favourite Items (Customer)']
    // #swagger.summary = 'Get favourite items for a user'
);
router.post("/add", authenticate, favItemController.createFavouriteItem
    // #swagger.tags = ['Favourite Items (Customer)']
    // #swagger.summary = 'Add an item to favourites'
);
router.delete("/delete", authenticate, favItemController.deleteFavouriteItem
    // #swagger.tags = ['Favourite Items (Customer)']
    // #swagger.summary = 'Remove an item from favourites'
);
router.get("/counts", favItemController.getFavouriteCounts
    // #swagger.tags = ['Favourite Items (Customer)']
    // #swagger.summary = 'Get counts of a item for all users'
);

module.exports = router;