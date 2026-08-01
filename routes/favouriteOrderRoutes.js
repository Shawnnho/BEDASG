const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const favouriteOrderController = require('../controllers/favouriteOrderController');

router.get('/:uid', verifyToken, favouriteOrderController.getFavourite
    // #swagger.tags = ['Favourite Order (Customer)']
    // #swagger.summary = "Get the user's saved favourite order"
);
router.put('/:uid', verifyToken, favouriteOrderController.saveFavourite
    // #swagger.tags = ['Favourite Order (Customer)']
    // #swagger.summary = "Save or update the user's favourite order"
);
router.delete('/:uid', verifyToken, favouriteOrderController.deleteFavourite
    // #swagger.tags = ['Favourite Order (Customer)']
    // #swagger.summary = "Delete the user's favourite order"
);

module.exports = router;