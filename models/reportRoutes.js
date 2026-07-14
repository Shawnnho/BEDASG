const express = require("express");
const router = express.Router();

const feedbackReportController = require("../controllers/feedbackReportController");
const { verifyToken } = require("../middlewares/auth");

router.post("/", verifyToken, feedbackReportController.createReport);

module.exports = router;

