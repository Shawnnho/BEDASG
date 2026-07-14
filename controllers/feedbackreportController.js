const feedbackReportModel = require("../models/feedbackreportModel");
const stallReviewModel = require("../models/stallReviewModel");

const VALID_REASONS = ["Spam", "Inappropriate Content", "Fake Review", "Harassment", "Other"];

// POST /api/reports

async function createReport(req, res) {
  try {
    const reporterUserId = req.user.userId; 
    const { reviewId, reason, details } = req.body;

    if (!reviewId) return res.status(400).json({ error: "reviewId is required." });
    if (!reason || !VALID_REASONS.includes(reason)) {
      return res.status(400).json({ error: "Please select a reason." });
    }

    const review = await stallReviewModel.getReviewById(reviewId);
    if (!review) return res.status(404).json({ error: "Review not found." });

    if (review.UserId === reporterUserId) {
      return res.status(400).json({ error: "You can't report your own review." });
    }

    const alreadyReported = await feedbackReportModel.hasUserReported(reviewId, reporterUserId);
    if (alreadyReported) {
      return res.status(409).json({ error: "You've already reported this review." });
    }

    const { reportId } = await feedbackReportModel.createReport({
      reviewId,
      reporterUserId,
      reason,
      details: details || null,
    });

    res.status(201).json({ reportId });
  } catch (err) {
    console.error("createReport error:", err.message);
    res.status(500).json({ error: "Failed to submit report." });
  }
}

module.exports = { createReport, VALID_REASONS };