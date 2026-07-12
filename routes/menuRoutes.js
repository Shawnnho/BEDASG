const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");

// USE /api/menu

//get menu items for a specific stall
router.get("/:id", menuController.getMenuItems);


module.exports = router;