const express = require("express");
const router = express.Router();
const hygieneController = require("../controllers/hygieneController");
const { verifyToken } = require("../middlewares/auth");

router.get("/stalls", verifyToken, (req, res) => {
  // #swagger.tags = ['Hygiene Grade']
  // #swagger.summary = 'List all stalls with their current hygiene grade'
  hygieneController.listStalls(req, res);
});

router.get("/stalls/:stallId", verifyToken, (req, res) => {
  // #swagger.tags = ['Hygiene Grade']
  // #swagger.summary = "Get a single stall's hygiene grade detail"
  hygieneController.getStall(req, res);
});

router.get("/stalls/:stallId/inspections", verifyToken, (req, res) => {
  // #swagger.tags = ['Hygiene Grade']
  // #swagger.summary = "Get a stall's past inspection history"
  hygieneController.getInspections(req, res);
});

router.get("/stalls/:stallId/market", verifyToken, (req, res) => {
  // #swagger.tags = ['Hygiene Grade']
  // #swagger.summary = "Compare a stall's grade against others in its hawker centre"
  hygieneController.getMarketComparison(req, res);
});

module.exports = router;