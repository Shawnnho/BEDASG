const express = require("express");
const router = express.Router();

const stallReviewController = require("../controllers/stallReviewController");
const { verifyToken } = require("../middlewares/auth");

router.use(express.json({ limit: "8mb" }));

router.get("/latest", stallReviewController.getLatestReviews);

router.get("/summary/:stallId", stallReviewController.getStallRating);

router.get("/search", stallReviewController.searchReviews);

router.post("/", verifyToken, stallReviewController.createReview);
router.get("/mine", verifyToken, stallReviewController.getMyReviews);

// Owner dashboard: reviews for the stall this user owns
router.get("/my-stall", verifyToken, stallReviewController.getMyStallReviews);

// Public: all reviews for one stall
router.get("/stall/:stallId", stallReviewController.getReviewsByStall);

router.get("/:reviewId", stallReviewController.getReview);

module.exports = router;
