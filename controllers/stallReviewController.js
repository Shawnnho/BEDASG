const stallReviewModel = require("../models/stallReviewModel");
const { saveBase64Image } = require("../middlewares/imageStorage");

// POST /api/reviews  (application/json — image sent as a base64 data URL)
async function createReview(req, res) {
  try {
    const userId = req.user.userId; // set by verifyToken from the accessToken cookie
    const userName = req.user.name || req.user.email || "User";

    const { stallId, rating, reviewText, isAnonymous, image } = req.body;

    // tags arrives as a plain array in JSON now (no multipart repeated-field
    // quirks to normalise like before).
    let tags = Array.isArray(req.body.tags) ? req.body.tags : [];

    if (!stallId) return res.status(400).json({ error: "Please select a stall." });

    const ratingNum = Number(rating);
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5." });
    }

    let imageUrl = null;
    if (image) {
      try {
        imageUrl = saveBase64Image({ dataUrl: image, subfolder: "reviews", uid: userId });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    const { reviewId } = await stallReviewModel.createReview({
      stallId,
      userId,
      userName,
      rating: ratingNum,
      reviewText: reviewText || "",
      isAnonymous: isAnonymous === true || isAnonymous === "true",
      imageUrl,
      tags: tags.filter(Boolean).slice(0, 3), // matches "Select up to 3" in the UI
    });

    res.status(201).json({ reviewId });
  } catch (err) {
    console.error("createReview error:", err.message);
    res.status(500).json({ error: "Failed to submit review." });
  }
}

// GET /api/reviews/latest?limit=20 — public, no auth required (feeds the carousel)
async function getLatestReviews(req, res) {
  try {
    const limitCount = Math.min(Number(req.query.limit) || 20, 50);
    const reviews = await stallReviewModel.getLatestReviews(limitCount);
    res.json(reviews);
  } catch (err) {
    console.error("getLatestReviews error:", err.message);
    res.status(500).json({ error: "Failed to retrieve reviews." });
  }
}

// GET /api/reviews/mine
async function getMyReviews(req, res) {
  try {
    const reviews = await stallReviewModel.getReviewsByUser(req.user.userId);
    res.json(reviews);
  } catch (err) {
    console.error("getMyReviews error:", err.message);
    res.status(500).json({ error: "Failed to retrieve reviews." });
  }
}

// GET /api/reviews/summary/:stallId — public, e.g. for a stall page's ★ badge
async function getStallRating(req, res) {
  try {
    const { stallId } = req.params;
    const summary = await stallReviewModel.getStallRatingSummary(stallId);
    res.json(summary);
  } catch (err) {
    console.error("getStallRating error:", err.message);
    res.status(500).json({ error: "Failed to retrieve rating summary." });
  }
}

module.exports = { createReview, getLatestReviews, getMyReviews, getStallRating };