const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");

async function createReview({
  stallId,
  userId,
  itemId,
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
  const isItemReview = itemId ? true : false;

  const userRes = await pool
    .request()
    .input("searchUid", sql.NVarChar, userId)
    .query("SELECT * FROM dbo.Users WHERE UserId = @searchUid");

  let finalUserName = userName;
  if (userRes.recordset.length > 0) {
    const row = userRes.recordset[0];
    finalUserName =
      row.Name || row.UserName || row.FullName || row.FirstName || userName;
  }

  if (isAnonymous) {
    finalUserName = "Anonymous";
  }

  await pool
    .request()
    .input("reviewId", sql.NVarChar, reviewId)
    .input("stallId", sql.NVarChar, stallId)
    .input("userId", sql.NVarChar, userId)
    .input("itemId", sql.NVarChar, itemId || null)
    .input("userName", sql.NVarChar, finalUserName)
    .input("rating", sql.Int, isItemReview ? null : rating)
    .input("itemStar", sql.Int, isItemReview ? rating : null)
    .input("reviewText", sql.NVarChar, isItemReview ? null : reviewText || null)
    .input("itemReview", sql.NVarChar, isItemReview ? reviewText || null : null)
    .input("isAnonymous", sql.Bit, isAnonymous ? 1 : 0)
    .input("imageUrl", sql.NVarChar(sql.MAX), imageUrl || null)
    .input("tagsJson", sql.NVarChar, tagsJson).query(`
      INSERT INTO dbo.StallReviews
        (ReviewId, StallId, UserId, ItemId, UserName, Rating, ItemStar, ReviewText, ItemReview, IsAnonymous, ImageUrl, TagsJson, CreatedAt)
      VALUES
        (@reviewId, @stallId, @userId, @itemId, @userName, @rating, @itemStar, @reviewText, @itemReview, @isAnonymous, @imageUrl, @tagsJson, SYSUTCDATETIME());
    `);

  return { reviewId };
}

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
  // Only STALL reviews count toward the stall's rating. Item ratings
  // (ItemId IS NOT NULL) live in the same table but must be excluded, or
  // COUNT(*) inflates the review count and the average is skewed.
  const result = await pool.request().input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT
        COUNT(*) AS ReviewCount,
        ISNULL(AVG(CAST(Rating AS FLOAT)), 0) AS AverageRating
      FROM dbo.StallReviews
      WHERE StallId = @stallId
        AND ItemId IS NULL;
    `);
  const row = result.recordset[0];
  return { reviewCount: row.ReviewCount, averageRating: row.AverageRating };
}

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

// STALL-LEVEL reviews only (ItemId IS NULL). These are the cards your review
// page has always shown: UserName, Rating, ReviewText, TagsJson.
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
        AND r.ItemId IS NULL
      ORDER BY r.CreatedAt DESC;
    `);
  return result.recordset;
}

// Individual per-review item ratings (ItemId IS NOT NULL). One row per rating,
// reading ItemStar / ItemReview instead of Rating / ReviewText. No menu-table
// join here — resolve ItemId -> readable name on the frontend where the menu
// is already loaded, so this query can't break if menu columns change.
async function getItemReviewsByStall(stallId) {
  const pool = await poolPromise;
  const result = await pool.request().input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT
        r.ReviewId, r.StallId, r.UserId, r.UserName, r.ItemId,
        r.ItemStar, r.ItemReview, r.IsAnonymous, r.CreatedAt
      FROM dbo.StallReviews r
      WHERE r.StallId = @stallId
        AND r.ItemId IS NOT NULL
      ORDER BY r.CreatedAt DESC;
    `);
  return result.recordset;
}

// Per-item aggregate: average stars + count, grouped by ItemId. Powers a
// "breakdown by item" section. Again keyed by ItemId; name it on the frontend.
async function getItemRatingSummaryByStall(stallId) {
  const pool = await poolPromise;
  const result = await pool.request().input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT
        r.ItemId,
        COUNT(*) AS RatingCount,
        ISNULL(AVG(CAST(r.ItemStar AS FLOAT)), 0) AS AverageStar
      FROM dbo.StallReviews r
      WHERE r.StallId = @stallId
        AND r.ItemId IS NOT NULL
      GROUP BY r.ItemId
      ORDER BY COUNT(*) DESC;
    `);
  return result.recordset;
}

async function getReviewCountSince(stallId, sinceIso) {
  const pool = await poolPromise;
  const request = pool.request().input("stallId", sql.NVarChar, stallId);

  let timeCondition = "";
  if (sinceIso) {
    const sinceDate = new Date(Number(sinceIso) || sinceIso);
    request.input("since", sql.DateTime, sinceDate);
    timeCondition = "AND CreatedAt > @since";
  }

  // Only new STALL reviews should trigger the "new review" badge/popup.
  // A new item rating is a different event and shouldn't inflate this count.
  const result = await request.query(`
    SELECT COUNT(*) AS NewCount
    FROM dbo.StallReviews
    WHERE StallId = @stallId
      AND ItemId IS NULL
      ${timeCondition};
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
  getItemReviewsByStall,
  getItemRatingSummaryByStall,
  getReviewCountSince,
};
