const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");
const menuController = require("../controllers/stallMenuController");
const { enforceRentPaywall } = require("../middlewares/rentPaywall");

// Applies to every route below: must be logged in, and stall must not be behind on rent
router.use(verifyToken, enforceRentPaywall());

// ===== Menu items =====
router.get("/menu", menuController.getMenu);
router.post("/menu", menuController.createMenu);
router.patch("/menu/:menuId", menuController.editMenu);
router.patch("/menu/:menuId/toggle", menuController.toggleMenu);
router.delete("/menu/:menuId", menuController.removeMenu);

// ===== Add-ons =====
router.get("/addons", menuController.getAddons);
router.post("/addons", menuController.createAddon);
router.patch("/addons/:addonId", menuController.editAddon);
router.patch("/addons/:addonId/toggle", menuController.toggleAddon);
router.delete("/addons/:addonId", menuController.removeAddon);

module.exports = router;
