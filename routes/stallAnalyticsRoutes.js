const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");
const analyticsController = require("../controllers/stallAnalyticsController");
const { enforceRentPaywall } = require("../middlewares/rentPaywall");

router.get("/analytics", verifyToken, analyticsController.getAnalytics);
router.use(verifyToken, enforceRentPaywall());

module.exports = router;
