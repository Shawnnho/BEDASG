const express = require("express");
const router = express.Router();

const { verifyToken, requireRole } = require("../middlewares/auth");
const rentalController = require("../controllers/rentalController");

// All rental routes require a logged-in storeholder.
// NOTE: the paywall middleware is intentionally NOT applied here — the owner
// must always be able to reach these to see status and pay.
router.use(verifyToken, requireRole("storeholder"));

router.get("/status", rentalController.getStatus);
router.post("/pay", rentalController.payRent);
router.get("/notifications", rentalController.getNotifications);

module.exports = router;
