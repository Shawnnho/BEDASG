const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");
const analyticsController = require("../controllers/stallAnalyticsController");

router.get("/analytics", verifyToken, analyticsController.getAnalytics);

module.exports = router;
