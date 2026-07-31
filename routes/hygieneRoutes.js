const express = require("express");
const router = express.Router();
const hygieneController = require("../controllers/hygieneController");
const { verifyToken } = require("../middlewares/auth");

router.get("/stalls", verifyToken, hygieneController.listStalls);
/*  #swagger.tags = ['Hygiene Grade']
    #swagger.summary = 'List all stalls with their current hygiene grade' */

router.get("/stalls/:stallId", verifyToken, hygieneController.getStall);
/*  #swagger.tags = ['Hygiene Grade']
    #swagger.summary = "Get a single stall's hygiene grade detail" */

router.get(
  "/stalls/:stallId/inspections",
  verifyToken,
  hygieneController.getInspections,
);
/*  #swagger.tags = ['Hygiene Grade']
    #swagger.summary = "Get a stall's past inspection history" */

router.get(
  "/stalls/:stallId/market",
  verifyToken,
  hygieneController.getMarketComparison,
);
/*  #swagger.tags = ['Hygiene Grade']
    #swagger.summary = "Compare a stall's grade against others in its hawker centre" */

module.exports = router;