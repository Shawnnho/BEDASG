const express = require("express");
const router = express.Router();

const feedbackReportController = require("../controllers/feedbackReportController");
const { verifyToken } = require("../middlewares/auth");
const {
  requireReviewExists, requireNotOwnReview, requireNotAlreadyReported,
} = require("../middlewares/feedbackAuth");
const { 
    validateCreateReport 
} = require("../middlewares/feedbackValidation");

router.post("/", verifyToken, validateCreateReport, requireReviewExists, requireNotOwnReview, requireNotAlreadyReported,
  feedbackReportController.createReport,
);

module.exports = router;