const express = require("express");
const router = express.Router();

const feedbackCommentController = require("../controllers/feedbackcommentController");
const { verifyToken } = require("../middlewares/auth");
const { validateCreateComment } = require("../middlewares/feedbackValidation");

// Public
router.get("/:reviewId", feedbackCommentController.getComments);

router.post("/", verifyToken, validateCreateComment, feedbackCommentController.createComment);

module.exports = router;