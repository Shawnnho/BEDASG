const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");
const menuController = require("../controllers/stallMenuController");
const { enforceRentPaywall } = require("../middlewares/rentPaywall");



// ===== Menu items =====
router.use(verifyToken, enforceRentPaywall());
router.get("/menu", verifyToken, menuController.getMenu);
router.post("/menu", verifyToken, menuController.createMenu);
router.patch("/menu/:menuId", verifyToken, menuController.editMenu);
router.patch("/menu/:menuId/toggle", verifyToken, menuController.toggleMenu);
router.delete("/menu/:menuId", verifyToken, menuController.removeMenu);
router.patch("/addons/:addonId/toggle", verifyToken, menuController.toggleAddon);


// ===== Add-ons =====
router.get("/addons", verifyToken, menuController.getAddons);
router.post("/addons", verifyToken, menuController.createAddon);
router.patch("/addons/:addonId", verifyToken, menuController.editAddon);
router.delete("/addons/:addonId", verifyToken, menuController.removeAddon);

module.exports = router;
