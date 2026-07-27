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
router.put("/:reviewId", verifyToken, stallReviewController.updateReview);
router.delete("/:reviewId", verifyToken, stallReviewController.deleteReview);

// Owner dashboard
router.get("/my-stall", verifyToken, stallReviewController.getMyStallReviews);
router.get(
  "/my-stall/count",
  verifyToken,
  stallReviewController.getMyStallReviewCount,
);

// Public: all reviews for one stall
router.get("/stall/:stallId", stallReviewController.getReviewsByStall);

 
router.get("/:reviewId", stallReviewController.getReview);

module.exports = router;
