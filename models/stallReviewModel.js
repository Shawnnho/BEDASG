const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");

/*
  dbo.StallReviews columns (confirmed from SSMS):
    ReviewId      NVARCHAR  (PK)
    StallId       NVARCHAR
    UserId        NVARCHAR
    UserName      NVARCHAR
    Rating        INT
    ReviewText    NVARCHAR
    IsAnonymous   BIT
    ImageUrl      NVARCHAR  (nullable)
    TagsJson      NVARCHAR  (nullable)   -- JSON array string, e.g. ["Service"]
    CreatedAt     DATETIME

  NOTE: this table has no StallName column, only StallId — so anywhere
  you need the stall's display name (the carousel, feedback history),
  the queries below LEFT JOIN dbo.Stalls to pull StallName.
*/

async function createReview({
  stallId,
  userId,
  userName,
  rating,
  reviewText,
  isAnonymous,
  imageUrl,
  tags,
}) {
  const pool = await poolPromise;
  const reviewId = crypto.randomUUID();
  const tagsJson = JSON.stringify(tags || []);

  await pool
    .request()
    .input("reviewId", sql.NVarChar, reviewId)
    .input("stallId", sql.NVarChar, stallId)
    .input("userId", sql.NVarChar, userId)
    .input("userName", sql.NVarChar, isAnonymous ? "Anonymous" : userName)
    .input("rating", sql.Int, rating)
    .input("reviewText", sql.NVarChar, reviewText || "")
    .input("isAnonymous", sql.Bit, isAnonymous ? 1 : 0)
    .input("imageUrl", sql.NVarChar, imageUrl || null)
    .input("tagsJson", sql.NVarChar, tagsJson)
    .query(`
      INSERT INTO dbo.StallReviews
        (ReviewId, StallId, UserId, UserName, Rating, ReviewText, IsAnonymous, ImageUrl, TagsJson, CreatedAt)
      VALUES
        (@reviewId, @stallId, @userId, @userName, @rating, @reviewText, @isAnonymous, @imageUrl, @tagsJson, GETDATE());
    `);

  return { reviewId };
}

// Latest reviews across all stalls — feeds the public carousel on feedback.html.
async function getLatestReviews(limitCount = 20) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("limitCount", sql.Int, limitCount)
    .query(`
      SELECT TOP (@limitCount)
        r.ReviewId, r.StallId, r.UserId, r.UserName, r.Rating, r.ReviewText,
        r.IsAnonymous, r.ImageUrl, r.TagsJson, r.CreatedAt,
        s.StallName
      FROM dbo.StallReviews r
      LEFT JOIN dbo.Stalls s ON r.StallId = s.StallId
      ORDER BY r.CreatedAt DESC;
    `);
  return result.recordset;
}

// A single user's reviews — feeds feedback_history.js.
async function getReviewsByUser(userId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("userId", sql.NVarChar, userId)
    .query(`
      SELECT
        r.ReviewId, r.StallId, r.UserId, r.UserName, r.Rating, r.ReviewText,
        r.IsAnonymous, r.ImageUrl, r.TagsJson, r.CreatedAt,
        s.StallName
      FROM dbo.StallReviews r
      LEFT JOIN dbo.Stalls s ON r.StallId = s.StallId
      WHERE r.UserId = @userId
      ORDER BY r.CreatedAt DESC;
    `);
  return result.recordset;
}

// dbo.Stalls has no ratingTotal/ratingCount columns (unlike the old Firestore
// stall doc), so instead of a denormalized counter kept in sync via a
// transaction, this just computes the average live from StallReviews.
async function getStallRatingSummary(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT
        COUNT(*) AS ReviewCount,
        ISNULL(AVG(CAST(Rating AS FLOAT)), 0) AS AverageRating
      FROM dbo.StallReviews
      WHERE StallId = @stallId;
    `);
  const row = result.recordset[0];
  return { reviewCount: row.ReviewCount, averageRating: row.AverageRating };
}

module.exports = { createReview, getLatestReviews, getReviewsByUser, getStallRatingSummary };