const express = require("express");
const router = express.Router();

const operatorController = require("../controllers/operatorController");
const { verifyToken } = require("../middlewares/auth");

function requireOperatorRole(req, res, next) {
  if (req.user?.role !== "operator") {
    return res.status(403).json({ error: "Operator access only." });
  }
  next();
}

router.use(verifyToken, requireOperatorRole);

router.get("/centres", operatorController.getMyCentres);
router.get("/overview", operatorController.getOverview);

router.get("/centres/:centreId/stalls", operatorController.getStallsForCentre);

router.get("/centres/:centreId/rentals", operatorController.getRentalsForCentre);
router.post("/rentals", operatorController.createRental);
router.delete("/rentals/:agreementId", operatorController.deleteRental);

router.put("/bills/:stallId/:billMonth", operatorController.saveBill);

module.exports = router;

