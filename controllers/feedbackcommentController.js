const feedbackCommentModel = require("../models/feedbackcommentModel");

// POST /api/comments

async function createComment(req, res) {
  // #swagger.tags = ['Comments']
  try {
    const userId = req.user.userId;
    const userName = req.user.name || req.user.email || "User";
    const { reviewId, commentText } = req.body;

    const { commentId } = await feedbackCommentModel.createComment({
      reviewId,
      userId,
      userName,
      commentText,
    });

    res.status(201).json({ commentId });
  } catch (err) {
    console.error("createComment error:", err.message);
    res.status(500).json({ error: "Failed to submit comment." });
  }
}

// GET /api/comments/:reviewId
async function getComments(req, res) {
  // #swagger.tags = ['Comments']
  try {
    const { reviewId } = req.params;
    const comments = await feedbackCommentModel.getCommentsByReview(reviewId);
    res.json(comments);
  } catch (err) {
    console.error("getComments error:", err.message);
    res.status(500).json({ error: "Failed to retrieve comments." });
  }
}

module.exports = { createComment, getComments };