const express = require("express");
const router = express.Router();

const stallReviewController = require("../controllers/stallReviewController");
const { verifyToken } = require("../middlewares/auth");
const {
  requireReviewExists,
  requireReviewOwnership,
} = require("../middlewares/feedbackAuth");
const {
  validateCreateReview,
  validateUpdateReview,
  validateReviewIdParam,
} = require("../middlewares/feedbackValidation");

router.use(express.json({ limit: "8mb" }));

router.get("/latest", (req, res) => {
  // #swagger.tags = ['Reviews']
  // #swagger.summary = 'Get the latest reviews across all stalls'
  stallReviewController.getLatestReviews(req, res);
});
router.get("/summary/:stallId", (req, res) => {
  // #swagger.tags = ['Reviews']
  // #swagger.summary = "Get a stall's rating summary"
  stallReviewController.getStallRating(req, res);
});
router.get("/search", (req, res) => {
  // #swagger.tags = ['Reviews']
  // #swagger.summary = 'Search reviews'
  stallReviewController.searchReviews(req, res);
});

router.post("/", verifyToken, validateCreateReview, (req, res) => {
  // #swagger.tags = ['Reviews']
  // #swagger.summary = 'Create a review'
  stallReviewController.createReview(req, res);
});
router.get("/mine", verifyToken, (req, res) => {
  // #swagger.tags = ['Reviews']
  // #swagger.summary = "Get the logged-in user's own reviews"
  stallReviewController.getMyReviews(req, res);
});
router.put(
  "/:reviewId",
  verifyToken,
  validateReviewIdParam,
  validateUpdateReview,
  requireReviewExists,
  requireReviewOwnership,
  (req, res) => {
    // #swagger.tags = ['Reviews']
    // #swagger.summary = 'Edit own review'
    stallReviewController.updateReview(req, res);
  },
);
router.delete(
  "/:reviewId",
  verifyToken,
  validateReviewIdParam,
  requireReviewExists,
  requireReviewOwnership,
  (req, res) => {
    // #swagger.tags = ['Reviews']
    // #swagger.summary = 'Delete own review'
    stallReviewController.deleteReview(req, res);
  },
);

router.get("/my-stall", verifyToken, (req, res) => {
  // #swagger.tags = ['Stall Reviews']
  // #swagger.summary = "Get all reviews and item ratings for the owner's stall"
  stallReviewController.getMyStallReviews(req, res);
});
router.get("/my-stall/count", verifyToken, (req, res) => {
  // #swagger.tags = ['Stall Reviews']
  // #swagger.summary = 'Count of new reviews since a given time (for notifications)'
  stallReviewController.getMyStallReviewCount(req, res);
});

// Public: all reviews for one stall
router.get("/stall/:stallId", (req, res) => {
  // #swagger.tags = ['Reviews']
  // #swagger.summary = 'Get all reviews for one stall'
  stallReviewController.getReviewsByStall(req, res);
});

router.get("/:reviewId", (req, res) => {
  // #swagger.tags = ['Reviews']
  // #swagger.summary = 'Get a single review by id'
  stallReviewController.getReview(req, res);
});

module.exports = router;
