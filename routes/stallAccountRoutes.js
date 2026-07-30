const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");
const accountController = require("../controllers/stallAccountController");

// All account routes require a valid JWT cookie
router.get("/account", verifyToken, (req, res) => {
  // #swagger.tags = ['Stall Account']
  // #swagger.summary = 'Get profile, stall details, hours, and notification prefs'
  accountController.getAccount(req, res);
});

router.patch("/account/profile", verifyToken, (req, res) => {
  // #swagger.tags = ['Stall Account']
  // #swagger.summary = "Update the owner's profile (name, phone, avatar)"
  accountController.updateProfile(req, res);
});
router.patch("/account/notifications", verifyToken, (req, res) => {
  // #swagger.tags = ['Stall Account']
  // #swagger.summary = 'Save notification preferences'
  accountController.updateNotifPrefs(req, res);
});
router.patch("/account/stall", verifyToken, (req, res) => {
  // #swagger.tags = ['Stall Account']
  // #swagger.summary = 'Update stall details and opening hours'
  accountController.updateStall(req, res);
});
router.patch("/account/stall-active", verifyToken, (req, res) => {
  // #swagger.tags = ['Stall Account']
  // #swagger.summary = 'Set the stall live or closed'
  accountController.setStallActive(req, res);
});
router.patch("/account/password", verifyToken, (req, res) => {
  // #swagger.tags = ['Stall Account']
  // #swagger.summary = 'Change the account password'
  accountController.changePassword(req, res);
});

router.post("/account/deactivate", verifyToken, (req, res) => {
  // #swagger.tags = ['Stall Account']
  // #swagger.summary = 'Deactivate the account (password-confirmed)'
  accountController.deactivateAccount(req, res);
});

module.exports = router;
