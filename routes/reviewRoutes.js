const express = require("express");
const router = express.Router();

const stallReviewController = require("../controllers/stallReviewController");
const { verifyToken } = require("../middlewares/auth");

// Public — feeds the feedback.html carousel, no login required to view
router.get("/latest", stallReviewController.getLatestReviews);

// Public — average rating + count for a single stall, e.g. a stall page badge
router.get("/summary/:stallId", stallReviewController.getStallRating);

router.post("/", verifyToken, stallReviewController.createReview);
router.get("/mine", verifyToken, stallReviewController.getMyReviews);

module.exports = router;

