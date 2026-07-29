const express = require("express");
const router = express.Router();

const operatorController = require("../controllers/operatorController");
const { verifyToken } = require("../middlewares/auth");
const {
  requireCentreOwnershipFromParam,
  requireCentreOwnershipFromBody,
  requireCentreOwnershipFromReqStall,
  requireStallExists,
  requireStallExistsLoose,
  requireStallBelongsToCentre,
  requireAgreementExists,
  requireCentreOwnershipFromReqAgreement,
  requireReportExists,
  requireReviewFromReqReport,
  requireStallFromReqReview,
} = require("../middlewares/operatorAuth");
const {
  validateCreateRental,
  validateSaveBillBody,
  validateSaveBillParams,
  validateCentreIdParam,
  validateStallIdParam,
  validateAgreementIdParam,
  validateReportIdParam,
} = require("../middlewares/operatorValidation"); 

function requireOperatorRole(req, res, next) {
  if (req.user?.role !== "operator") {
    return res.status(403).json({ error: "Operator access only." });
  }
  next();
}

router.use(verifyToken, requireOperatorRole);

router.get("/centres", operatorController.getMyCentres);
router.get("/overview", operatorController.getOverview);

router.get("/stalls", operatorController.getAllStallsForOperator);
router.get(
  "/centres/:centreId/stalls",
  validateCentreIdParam,
  requireCentreOwnershipFromParam,
  operatorController.getStallsForCentre,
);
router.get(
  "/stalls/:stallId/complaints",
  validateStallIdParam,
  requireStallExistsLoose,
  requireCentreOwnershipFromReqStall,
  operatorController.getStallComplaints,
);



router.get("/rentals", operatorController.getAllRentalsForOperator);
router.get(
  "/centres/:centreId/rentals",
  validateCentreIdParam,
  requireCentreOwnershipFromParam,
  operatorController.getRentalsForCentre,
);
router.post(
  "/rentals",
  validateCreateRental,
  requireCentreOwnershipFromBody,
  requireStallExists,
  requireStallBelongsToCentre,
  operatorController.createRental,
);
router.delete(
  "/rentals/:agreementId",
  validateAgreementIdParam,
  requireAgreementExists,
  requireCentreOwnershipFromReqAgreement,
  operatorController.deleteRental,
);

// --- Monthly Bills -------------------------------------------------------------

router.put(
  "/bills/:stallId/:billMonth",
  validateSaveBillParams,
  validateSaveBillBody,
  requireCentreOwnershipFromBody,
  requireStallExistsLoose,
  requireStallBelongsToCentre,
  operatorController.saveBill,
);

// --- Reported Reviews ----------------------------------------------------------

router.get("/reports", operatorController.getReportedReviews);
router.post(
  "/reports/:reportId/dismiss",
  validateReportIdParam,
  requireReportExists,
  requireReviewFromReqReport,
  requireStallFromReqReview,
  requireCentreOwnershipFromReqStall,
  operatorController.dismissReport,
);
router.delete(
  "/reports/:reportId/review",
  validateReportIdParam,
  requireReportExists,
  requireReviewFromReqReport,
  requireStallFromReqReview,
  requireCentreOwnershipFromReqStall,
  operatorController.deleteReportedReview,
);

module.exports = router;