const centreModel = require("../models/centreModel");
const stallModel = require("../models/stallModel");
const rentalAgreementModel = require("../models/rentalAgreementModel");
const feedbackReportModel = require("../models/feedbackreportModel");
const stallReviewModel = require("../models/stallReviewModel");

// Wraps an async middleware so a thrown error becomes a 500 instead of
// crashing/hanging the request — Express doesn't catch async rejections on
// its own.
function asyncMw(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => {
      console.error("operatorAuth middleware error:", err.message);
      res.status(500).json({ error: "Internal server error." });
    });
  };
}

// --- Centre ownership -------------------------------------------------

// For routes where centreId is a URL param, e.g. /centres/:centreId/stalls
const requireCentreOwnershipFromParam = asyncMw(async (req, res, next) => {
  const { centreId } = req.params;
  const centre = await centreModel.getCentreForOperator(centreId, req.user.userId);
  if (!centre) return res.status(403).json({ error: "Forbidden: not your centre." });
  req.centre = centre;
  next();
});

// For routes where centreId is in the request body, e.g. POST /rentals
const requireCentreOwnershipFromBody = asyncMw(async (req, res, next) => {
  const { centreId } = req.body;
  if (!centreId) return res.status(400).json({ error: "centreId is required." });
  const centre = await centreModel.getCentreForOperator(centreId, req.user.userId);
  if (!centre) return res.status(403).json({ error: "Forbidden: not your centre." });
  req.centre = centre;
  next();
});

// For routes with no centreId anywhere in the request at all — ownership
// has to be derived from a stall already attached to req.stall by an
// earlier middleware in the chain (e.g. getStallComplaints, report routes).
const requireCentreOwnershipFromReqStall = asyncMw(async (req, res, next) => {
  const centre = await centreModel.getCentreForOperator(req.stall.CentreId, req.user.userId);
  if (!centre) return res.status(403).json({ error: "Forbidden: not your centre." });
  req.centre = centre;
  next();
});

// --- Stall existence ----------------------------------------------------

// Active/canonical stall only — used where the stall must be a real,
// currently orderable stall (creating a new rental agreement).
const requireStallExists = asyncMw(async (req, res, next) => {
  const stallId = req.params.stallId || req.body.stallId;
  const stall = await stallModel.getStallById(stallId);
  if (!stall) return res.status(404).json({ error: "Stall not found." });
  req.stall = stall;
  next();
});

// Looser existence check (not filtered by IsActive/IsCanonical) — a
// deactivated/archived stall's bills and complaint history still need to
// stay reachable by the operator who owns it.
const requireStallExistsLoose = asyncMw(async (req, res, next) => {
  const stallId = req.params.stallId || req.body.stallId;
  const stall = await stallModel.getStallCentreId(stallId);
  if (!stall) return res.status(404).json({ error: "Stall not found." });
  req.stall = stall;
  next();
});

// Must run after both a stall-fetching middleware AND a centre-ownership
// middleware — confirms the stall actually belongs to the centre already
// validated as this operator's own.
function requireStallBelongsToCentre(req, res, next) {
  if (req.stall.CentreId !== req.centre.CentreId) {
    return res.status(400).json({ error: "Stall does not belong to this centre." });
  }
  next();
}

// --- Rental agreement existence -----------------------------------------

const requireAgreementExists = asyncMw(async (req, res, next) => {
  const { agreementId } = req.params;
  const agreement = await rentalAgreementModel.getRentalAgreementById(agreementId);
  if (!agreement) return res.status(404).json({ error: "Rental agreement not found." });
  req.agreement = agreement;
  next();
});

// Ownership derived from the agreement's own CentreId — used for
// DELETE /rentals/:agreementId, which has no centreId in the request itself.
const requireCentreOwnershipFromReqAgreement = asyncMw(async (req, res, next) => {
  const centre = await centreModel.getCentreForOperator(req.agreement.CentreId, req.user.userId);
  if (!centre) return res.status(403).json({ error: "Forbidden: not your centre." });
  req.centre = centre;
  next();
});

// --- Report moderation chain ---------------------------------------------

const requireReportExists = asyncMw(async (req, res, next) => {
  const { reportId } = req.params;
  const report = await feedbackReportModel.getReportById(reportId);
  if (!report) return res.status(404).json({ error: "Report not found." });
  req.report = report;
  next();
});

// Must run after requireReportExists
const requireReviewFromReqReport = asyncMw(async (req, res, next) => {
  const review = await stallReviewModel.getReviewById(req.report.ReviewId);
  if (!review) return res.status(404).json({ error: "Review not found." });
  req.review = review;
  next();
});

// Must run after requireReviewFromReqReport
const requireStallFromReqReview = asyncMw(async (req, res, next) => {
  const stall = await stallModel.getStallById(req.review.StallId);
  if (!stall) return res.status(404).json({ error: "Stall not found." });
  req.stall = stall;
  next();
});

module.exports = {
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
};