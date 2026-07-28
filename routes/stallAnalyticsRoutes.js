const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");
const analyticsController = require("../controllers/stallAnalyticsController");
const { enforceRentPaywall } = require("../middlewares/rentPaywall");

// Scoped to this route only — stallAnalyticsRoutes shares the "/api/stall"
// mount prefix with orderRoutes/stallMenuRoutes/stallAccountRoutes, so a
// router-level router.use() here would paywall-gate their routes too.
router.get(
  "/analytics",
  verifyToken,
  enforceRentPaywall(),
  analyticsController.getAnalytics,
);

module.exports = router;
