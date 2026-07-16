const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");

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
    .input("imageUrl", sql.NVarChar(sql.MAX), imageUrl || null)
    .input("tagsJson", sql.NVarChar, tagsJson).query(`
      INSERT INTO dbo.StallReviews
        (ReviewId, StallId, UserId, UserName, Rating, ReviewText, IsAnonymous, ImageUrl, TagsJson, CreatedAt)
      VALUES
        (@reviewId, @stallId, @userId, @userName, @rating, @reviewText, @isAnonymous, @imageUrl, @tagsJson, GETDATE());
    `);

  return { reviewId };
}

// Get the latest reviews across all stalls
async function getLatestReviews(limitCount = 20) {
  const pool = await poolPromise;
  const result = await pool.request().input("limitCount", sql.Int, limitCount)
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

// Get A single user's reviews
async function getReviewsByUser(userId) {
  const pool = await poolPromise;
  const result = await pool.request().input("userId", sql.NVarChar, userId)
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

// Edit a review that a customer already submitted
async function updateReview(
  reviewId,
  { rating, reviewText, isAnonymous, tags },
) {
  const pool = await poolPromise;
  const tagsJson = JSON.stringify(tags || []);

  await pool
    .request()
    .input("reviewId", sql.NVarChar, reviewId)
    .input("rating", sql.Int, rating)
    .input("reviewText", sql.NVarChar, reviewText || "")
    .input("isAnonymous", sql.Bit, isAnonymous ? 1 : 0)
    .input("tagsJson", sql.NVarChar, tagsJson).query(`
      UPDATE dbo.StallReviews
      SET Rating = @rating,
          ReviewText = @reviewText,
          IsAnonymous = @isAnonymous,
          TagsJson = @tagsJson
      WHERE ReviewId = @reviewId;
    `);
}

// Delete a review that a customer already submitted
async function deleteReview(reviewId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("reviewId", sql.NVarChar, reviewId)
    .query("DELETE FROM dbo.StallReviews WHERE ReviewId = @reviewId");
  return result.rowsAffected[0] > 0;
}

async function getStallRatingSummary(stallId) {
  const pool = await poolPromise;
  const result = await pool.request().input("stallId", sql.NVarChar, stallId)
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

// Get A single review by id
async function getReviewById(reviewId) {
  const pool = await poolPromise;
  const result = await pool.request().input("reviewId", sql.NVarChar, reviewId)
    .query(`
      SELECT
        r.ReviewId, r.StallId, r.UserId, r.UserName, r.Rating, r.ReviewText,
        r.IsAnonymous, r.ImageUrl, r.TagsJson, r.CreatedAt,
        s.StallName
      FROM dbo.StallReviews r
      LEFT JOIN dbo.Stalls s ON r.StallId = s.StallId
      WHERE r.ReviewId = @reviewId;
    `);
  return result.recordset[0] || null;
}

async function searchReviews({ stallName, rating, limitCount = 50 }) {
  const pool = await poolPromise;
  const request = pool.request().input("limitCount", sql.Int, limitCount);

  const conditions = [];

  if (stallName) {
    request.input("stallName", sql.NVarChar, `%${stallName}%`);
    conditions.push("s.StallName LIKE @stallName");
  }

  if (rating) {
    request.input("rating", sql.Int, Number(rating));
    conditions.push("r.Rating = @rating");
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await request.query(`
    SELECT TOP (@limitCount)
      r.ReviewId, r.StallId, r.UserId, r.UserName, r.Rating, r.ReviewText,
      r.IsAnonymous, r.ImageUrl, r.TagsJson, r.CreatedAt,
      s.StallName
    FROM dbo.StallReviews r
    LEFT JOIN dbo.Stalls s ON r.StallId = s.StallId
    ${whereClause}
    ORDER BY r.CreatedAt DESC;
  `);
  return result.recordset;
}

// Get the stall belonging to a specific owner (Prioritizes the one with reviews)
async function getStallByOwnerUid(ownerUid) {
  const pool = await poolPromise;
  const result = await pool.request().input("ownerUid", sql.NVarChar, ownerUid)
    .query(`
      SELECT TOP 1 s.StallId, s.StallName, s.OwnerUid
      FROM dbo.Stalls s
      LEFT JOIN dbo.StallReviews r ON s.StallId = r.StallId
      WHERE s.OwnerUid = @ownerUid
      GROUP BY s.StallId, s.StallName, s.OwnerUid
      ORDER BY COUNT(r.ReviewId) DESC;
    `);

  return result.recordset[0] || null;
}

// Get all reviews for a specific stall
async function getReviewsByStall(stallId) {
  const pool = await poolPromise;
  const result = await pool.request().input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT
        r.ReviewId, r.StallId, r.UserId, r.UserName, r.Rating, r.ReviewText,
        r.IsAnonymous, r.ImageUrl, r.TagsJson, r.CreatedAt,
        s.StallName
      FROM dbo.StallReviews r
      LEFT JOIN dbo.Stalls s ON r.StallId = s.StallId
      WHERE r.StallId = @stallId
      ORDER BY r.CreatedAt DESC;
    `);
  return result.recordset;
}

// Get count of new reviews since a specific timestamp
async function getReviewCountSince(stallId, sinceIso) {
  const pool = await poolPromise;
  const request = pool.request().input("stallId", sql.NVarChar, stallId);

  let timeCondition = "";
  if (sinceIso) {
    // Convert the timestamp string (or number) to a Date object for MSSQL
    const sinceDate = new Date(Number(sinceIso) || sinceIso);
    request.input("since", sql.DateTime, sinceDate);
    timeCondition = "AND CreatedAt > @since";
  }

  const result = await request.query(`
    SELECT COUNT(*) AS NewCount
    FROM dbo.StallReviews
    WHERE StallId = @stallId ${timeCondition};
  `);

  return result.recordset[0]?.NewCount || 0;
}

module.exports = {
  createReview,
  getLatestReviews,
  getReviewsByUser,
  getStallRatingSummary,
  getReviewById,
  searchReviews,
  updateReview,
  deleteReview,
  getStallByOwnerUid,
  getReviewsByStall,
  getReviewCountSince,
};
