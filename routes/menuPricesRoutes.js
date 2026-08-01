const express = require("express");
const router = express.Router();
const menuPricesController = require("../controllers/menuPricesController");

// GET /api/menuprices/:id -> variants (name + price) for a specific menu item
router.get("/:id", menuPricesController.getItemPrices
    // #swagger.tags = ['Stalls (Customer)']
    // #swagger.summary = 'Get addons for a stall by ID'
);

module.exports = router;