const express = require("express");
const router = express.Router();

const { verifyToken, requireRole } = require("../middlewares/auth");
const rentalController = require("../controllers/rentalController");

// All rental routes require a logged-in storeholder.
// NOTE: the paywall middleware is intentionally NOT applied here — the owner
// must always be able to reach these to see status and pay.
router.use(verifyToken, requireRole("storeholder"));

router.get("/status", (req, res) => {
  // #swagger.tags = ['Rental Bill']
  // #swagger.summary = 'Get the current rental/operator bill status for the stall'
  rentalController.getStatus(req, res);
});
router.post("/pay", (req, res) => {
  // #swagger.tags = ['Rental Bill']
  // #swagger.summary = 'Pay the outstanding rental bill (simulated)'
  rentalController.payRent(req, res);
});
router.get("/notifications", (req, res) => {
  // #swagger.tags = ['Rental Bill']
  // #swagger.summary = 'Rental bill notifications and payment history'
  rentalController.getNotifications(req, res);
});

module.exports = router;