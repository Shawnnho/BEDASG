const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");
const accountController = require("../controllers/stallAccountController");

// All account routes require a valid JWT cookie
router.get("/account", verifyToken, accountController.getAccount);

router.patch("/account/profile", verifyToken, accountController.updateProfile);
router.patch(
  "/account/notifications",
  verifyToken,
  accountController.updateNotifPrefs,
);
router.patch("/account/stall", verifyToken, accountController.updateStall);
router.patch(
  "/account/stall-active",
  verifyToken,
  accountController.setStallActive,
);
router.patch(
  "/account/password",
  verifyToken,
  accountController.changePassword,
);

router.post(
  "/account/deactivate",
  verifyToken,
  accountController.deactivateAccount,
);

module.exports = router;
