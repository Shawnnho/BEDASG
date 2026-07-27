const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");


async function createComment({ reviewId, userId, userName, commentText }) {
  const pool = await poolPromise;
  const commentId = crypto.randomUUID();

  await pool
    .request()
    .input("commentId", sql.NVarChar, commentId)
    .input("reviewId", sql.NVarChar, reviewId)
    .input("userId", sql.NVarChar, userId)
    .input("userName", sql.NVarChar, userName)
    .input("commentText", sql.NVarChar, commentText)
    .query(`
      INSERT INTO dbo.FeedbackComments (CommentId, ReviewId, UserId, UserName, CommentText, CreatedAt)
      VALUES (@commentId, @reviewId, @userId, @userName, @commentText, GETDATE());
    `);

  return { commentId };
}

async function getCommentsByReview(reviewId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("reviewId", sql.NVarChar, reviewId)
    .query(`
      SELECT CommentId, ReviewId, UserId, UserName, CommentText, CreatedAt
      FROM dbo.FeedbackComments
      WHERE ReviewId = @reviewId
      ORDER BY CreatedAt ASC;
    `);
  return result.recordset;
}

module.exports = { 
createComment, getCommentsByReview 
};