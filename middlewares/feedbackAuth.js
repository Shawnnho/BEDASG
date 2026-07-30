const complaintModel = require("../models/complaintModel");
const stallReviewModel = require("../models/stallReviewModel");
const feedbackReportModel = require("../models/feedbackreportModel");

function asyncMw(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => {
      console.error("feedbackAuth middleware error:", err.message);
      res.status(500).json({ error: "Internal server error." });
    });
  };
}


const requireComplaintExists = asyncMw(async (req, res, next) => {
  const { complaintId } = req.params;
  const complaint = await complaintModel.getComplaintById(complaintId);
  if (!complaint) return res.status(404).json({ error: "Complaint not found." });
  req.complaint = complaint;
  next();
});

function requireComplaintOwnership(req, res, next) {
  if (req.complaint.Uid !== req.user.userId) {
    return res.status(403).json({ error: "You can only modify your own complaint." });
  }
  next();
}

const requireReviewExists = asyncMw(async (req, res, next) => {
  const reviewId = req.params.reviewId || req.body.reviewId;
  const review = await stallReviewModel.getReviewById(reviewId);
  if (!review) return res.status(404).json({ error: "Review not found." });
  req.review = review;
  next();
});

function requireReviewOwnership(req, res, next) {
  if (req.review.UserId !== req.user.userId) {
    return res.status(403).json({ error: "You can only modify your own review." });
  }
  next();
}


function requireNotOwnReview(req, res, next) {
  if (req.review.UserId === req.user.userId) {
    return res.status(400).json({ error: "You can't report your own review." });
  }
  next();
}

const requireNotAlreadyReported = asyncMw(async (req, res, next) => {
  const alreadyReported = await feedbackReportModel.hasUserReported(
    req.review.ReviewId,
    req.user.userId,
  );
  if (alreadyReported) {
    return res.status(409).json({ error: "You've already reported this review." });
  }
  next();
});

module.exports = {
  requireComplaintExists,
  requireComplaintOwnership,
  requireReviewExists,
  requireReviewOwnership,
  requireNotOwnReview,
  requireNotAlreadyReported,
};