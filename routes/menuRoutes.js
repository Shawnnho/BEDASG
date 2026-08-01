const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");

//get menu items for a specific stall /api/menu/:id
router.get("/:id", menuController.getMenuItems
    // #swagger.tags = ['Stalls (Customer)']
    // #swagger.summary = 'Get menu items for a specific stall'
);


module.exports = router;