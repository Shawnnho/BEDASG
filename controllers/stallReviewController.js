const stallReviewModel = require("../models/stallReviewModel");
const { validateBase64Image } = require("../middlewares/imageStorage");

// POST /api/reviews  (application/json — image sent as a base64 data URL)
async function createReview(req, res) {
  try {
    const userId = req.user.userId; // set by verifyToken from the accessToken cookie
    const userName = req.user.name || req.user.email || "User";

    const { stallId, rating, reviewText, isAnonymous, image } = req.body;

    let tags = Array.isArray(req.body.tags) ? req.body.tags : [];

    if (!stallId)
      return res.status(400).json({ error: "Please select a stall." });

    const ratingNum = Number(rating);
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5." });
    }

    let imageUrl = null;
    if (image) {
      try {
        // Stored directly in the DB row — no file on disk at all.
        imageUrl = validateBase64Image(image);
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

// GET /api/reviews/search?stallName=...&rating=... — public, feeds the General Feedback Page
async function searchReviews(req, res) {
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

// GET /api/reviews/stall/:stallId — public, all reviews for one stall
async function getReviewsByStall(req, res) {
  try {
    const { stallId } = req.params;
    const reviews = await stallReviewModel.getReviewsByStall(stallId);
    res.json(reviews);
  } catch (err) {
    console.error("getReviewsByStall error:", err.message);
    res.status(500).json({ error: "Failed to retrieve reviews." });
  }
}

// GET /api/reviews/my-stall — owner-only, reviews for the stall this user owns
async function getMyStallReviews(req, res) {
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

// GET /api/reviews/my-stall/count?since=<iso>
// How many reviews arrived after `since`. Powers the sidebar badge.
async function getMyStallReviewCount(req, res) {
  try {
    const ownerUid = req.user.userId;

    const stall = await stallReviewModel.getStallByOwnerUid(ownerUid);
    if (!stall) return res.json({ newCount: 0 });

    const since = req.query.since || null;
    const newCount = await stallReviewModel.getReviewCountSince(
      stall.StallId,
      since,
    );

    res.json({ newCount });
  } catch (err) {
    console.error("getMyStallReviewCount error:", err.message);
    res.status(500).json({ error: "Failed to count reviews." });
  }
}
// PUT /api/reviews/:reviewId — edit your own review (SA2PG-100)
async function updateReview(req, res) {
  try {
    const { reviewId } = req.params;
    const userId = req.user.userId;
 
    const review = await stallReviewModel.getReviewById(reviewId);
    if (!review) return res.status(404).json({ error: "Review not found." });
    if (review.UserId !== userId) {
      return res.status(403).json({ error: "You can only edit your own review." });
    }
 
    const { rating, reviewText, isAnonymous, tags } = req.body;
    const ratingNum = Number(rating);
 
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5." });
    }
    if (!reviewText || !reviewText.trim()) {
      return res.status(400).json({ error: "Review text cannot be empty." });
    }
 
    await stallReviewModel.updateReview(reviewId, {
      rating: ratingNum,
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
 
// DELETE /api/reviews/:reviewId — delete your own review (SA2PG-101)
async function deleteReview(req, res) {
  try {
    const { reviewId } = req.params;
    const userId = req.user.userId;
 
    const review = await stallReviewModel.getReviewById(reviewId);
    if (!review) return res.status(404).json({ error: "Review not found." });
    if (review.UserId !== userId) {
      return res.status(403).json({ error: "You can only delete your own review." });
    }
 
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
