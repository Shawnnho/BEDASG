const feedbackReportModel = require("../models/feedbackreportModel");

const VALID_REASONS = ["Spam", "Inappropriate Content", "Fake Review", "Harassment", "Other"];

// POST /api/reports

async function createReport(req, res) {
  try {
    const reporterUserId = req.user.userId;
    const { reviewId, reason, details } = req.body;

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