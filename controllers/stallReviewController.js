const stallReviewModel = require("../models/stallReviewModel");
const { validateBase64Image } = require("../middlewares/imageStorage");

// POST /api/reviews  (application/json — image sent as a base64 data URL)
async function createReview(req, res) {
  // #swagger.tags = ['Reviews']
  try {
    const userId = req.user.userId; 
    const userName = req.user.name || req.user.email || "User";

    const { stallId, rating, reviewText, isAnonymous, image } = req.body;
    const tags = Array.isArray(req.body.tags) ? req.body.tags : [];

    let imageUrl = null;
    if (image) {
      try {
        imageUrl = validateBase64Image(image);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    const { reviewId } = await stallReviewModel.createReview({
      stallId,
      userId,
      userName,
      rating,
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
  // #swagger.tags = ['Reviews']
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
  // #swagger.tags = ['Reviews']
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
  // #swagger.tags = ['Reviews']
  try {
    const { stallId } = req.params;
    const summary = await stallReviewModel.getStallRatingSummary(stallId);
    res.json(summary);
  } catch (err) {
    console.error("getStallRating error:", err.message);
    res.status(500).json({ error: "Failed to retrieve rating summary." });
  }
}

// GET /api/reviews/search?stallName=...&rating=...
async function searchReviews(req, res) {
  // #swagger.tags = ['Reviews']
  try {
    const { stallName, rating } = req.query;
    const reviews = await stallReviewModel.searchReviews({ stallName, rating });
    res.json(reviews);
  } catch (err) {
    console.error("searchReviews error:", err.message);
    res.status(500).json({ error: "Failed to search reviews." });
  }
}

// GET /api/reviews/:reviewId — public, used by report.html to show what's being reported
async function getReview(req, res) {
  // #swagger.tags = ['Reviews']
  try {
    const { reviewId } = req.params;
    const review = await stallReviewModel.getReviewById(reviewId);
    if (!review) return res.status(404).json({ error: "Review not found." });
    res.json(review);
  } catch (err) {
    console.error("getReview error:", err.message);
    res.status(500).json({ error: "Failed to retrieve review." });
  }
}

// GET /api/reviews/stall/:stallId — unchanged, out of scope for this refactor
async function getReviewsByStall(req, res) {
  // #swagger.tags = ['Reviews']
  try {
    const { stallId } = req.params;
    const reviews = await stallReviewModel.getReviewsByStall(stallId);
    res.json(reviews);
  } catch (err) {
    console.error("getReviewsByStall error:", err.message);
    res.status(500).json({ error: "Failed to retrieve reviews." });
  }
}

// GET /api/reviews/my-stall — unchanged, out of scope for this refactor
async function getMyStallReviews(req, res) {
  // #swagger.tags = ['Reviews']
  try {
    const ownerUid = req.user.userId;

    const stall = await stallReviewModel.getStallByOwnerUid(ownerUid);
    if (!stall) {
      return res.status(404).json({ error: "No stall found for this owner." });
    }

    const reviews = await stallReviewModel.getReviewsByStall(stall.StallId);
    const summary = await stallReviewModel.getStallRatingSummary(stall.StallId);

    res.json({
      stallId: stall.StallId,
      stallName: stall.StallName,
      summary,
      reviews,
    });
  } catch (err) {
    console.error("getMyStallReviews error:", err.message);
    res.status(500).json({ error: "Failed to retrieve reviews." });
  }
}

// GET /api/reviews/my-stall/count?since=<iso> — unchanged, out of scope for this refactor
async function getMyStallReviewCount(req, res) {
  // #swagger.tags = ['Reviews']
  try {
    const ownerUid = req.user.userId;

    const stall = await stallReviewModel.getStallByOwnerUid(ownerUid);
    if (!stall) return res.json({ newCount: 0 });

    const since = req.query.since || null;
    const newCount = await stallReviewModel.getReviewCountSince(stall.StallId, since);

    res.json({ newCount });
  } catch (err) {
    console.error("getMyStallReviewCount error:", err.message);
    res.status(500).json({ error: "Failed to count reviews." });
  }
}

// PUT /api/reviews/:reviewId
async function updateReview(req, res) {
  // #swagger.tags = ['Reviews']
  try {
    const { reviewId } = req.params;
    const { rating, reviewText, isAnonymous, tags } = req.body;

    await stallReviewModel.updateReview(reviewId, {
      rating,
      reviewText: reviewText.trim(),
      isAnonymous: isAnonymous === true || isAnonymous === "true",
      tags: Array.isArray(tags) ? tags.slice(0, 3) : [],
    });

    res.json({ success: true });
  } catch (err) {
    console.error("updateReview error:", err.message);
    res.status(500).json({ error: "Failed to update review." });
  }
}

// DELETE /api/reviews/:reviewId
async function deleteReview(req, res) {
  // #swagger.tags = ['Reviews']
  try {
    const { reviewId } = req.params;
    await stallReviewModel.deleteReview(reviewId);
    res.status(204).send();
  } catch (err) {
    console.error("deleteReview error:", err.message);
    res.status(500).json({ error: "Failed to delete review." });
  }
}

module.exports = {
  createReview,
  getLatestReviews,
  getMyReviews,
  getStallRating,
  searchReviews,
  getReview,
  getReviewsByStall,
  getMyStallReviews,
  getMyStallReviewCount,
  updateReview,
  deleteReview,
};