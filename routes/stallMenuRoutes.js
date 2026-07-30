const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");
const menuController = require("../controllers/stallMenuController");
const { enforceRentPaywall } = require("../middlewares/rentPaywall");

// Applies to every route below: must be logged in, and stall must not be behind on rent
router.use(verifyToken, enforceRentPaywall());

// ===== Menu items =====
router.get("/menu", (req, res) => {
  // #swagger.tags = ['Stall Menu']
  // #swagger.summary = "Get the stall's full menu (items, variant prices, features)"
  menuController.getMenu(req, res);
});
router.post("/menu", (req, res) => {
  // #swagger.tags = ['Stall Menu']
  // #swagger.summary = 'Create a new menu item (single or variant-priced)'
  menuController.createMenu(req, res);
});
router.patch("/menu/:menuId", (req, res) => {
  // #swagger.tags = ['Stall Menu']
  // #swagger.summary = 'Edit an existing menu item'
  menuController.editMenu(req, res);
});
router.patch("/menu/:menuId/toggle", (req, res) => {
  // #swagger.tags = ['Stall Menu']
  // #swagger.summary = 'Toggle a menu item active/inactive'
  menuController.toggleMenu(req, res);
});
router.delete("/menu/:menuId", (req, res) => {
  // #swagger.tags = ['Stall Menu']
  // #swagger.summary = 'Delete a menu item'
  menuController.removeMenu(req, res);
});

// ===== Add-ons =====
router.get("/addons", (req, res) => {
  // #swagger.tags = ['Stall Menu']
  // #swagger.summary = "List the stall's add-ons and category rules"
  menuController.getAddons(req, res);
});
router.post("/addons", (req, res) => {
  // #swagger.tags = ['Stall Menu']
  // #swagger.summary = 'Create a new add-on'
  menuController.createAddon(req, res);
});
router.patch("/addons/:addonId", (req, res) => {
  // #swagger.tags = ['Stall Menu']
  // #swagger.summary = 'Edit an add-on'
  menuController.editAddon(req, res);
});
router.patch("/addons/:addonId/toggle", (req, res) => {
  // #swagger.tags = ['Stall Menu']
  // #swagger.summary = 'Toggle an add-on active/inactive'
  menuController.toggleAddon(req, res);
});
router.delete("/addons/:addonId", (req, res) => {
  // #swagger.tags = ['Stall Menu']
  // #swagger.summary = 'Delete an add-on'
  menuController.removeAddon(req, res);
});

module.exports = router;
