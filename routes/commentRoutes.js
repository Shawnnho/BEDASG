const express = require("express");
const router = express.Router();

const feedbackCommentController = require("../controllers/feedbackcommentController");
const { verifyToken } = require("../middlewares/auth");

// Public 
router.get("/:reviewId", feedbackCommentController.getComments);

router.post("/", verifyToken, feedbackCommentController.createComment);

module.exports = router;