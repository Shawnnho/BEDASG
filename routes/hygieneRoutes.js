const express = require("express");
const router = express.Router();
const hygieneController = require("../controllers/hygieneController");
const { verifyToken } = require("../middlewares/auth");

router.get("/stalls", verifyToken, hygieneController.listStalls);
router.get("/stalls/:stallId", verifyToken, hygieneController.getStall);
router.get(
  "/stalls/:stallId/inspections",
  verifyToken,
  hygieneController.getInspections,
);
router.get(
  "/stalls/:stallId/market",
  verifyToken,
  hygieneController.getMarketComparison,
);

module.exports = router;
