const { sql, poolPromise } = require("../dbConfig");

async function getAverageRatingsByStallIds(stallIds) {
  if (!stallIds || stallIds.length === 0) return {};

  const pool = await poolPromise;
  const request = pool.request();

  const placeholders = stallIds.map((id, i) => {
    const paramName = `stallId${i}`;
    request.input(paramName, sql.NVarChar, id);
    return `@${paramName}`;
  });

  const result = await request.query(`
    SELECT StallId, AVG(CAST(Rating AS FLOAT)) AS AvgRating, COUNT(*) AS ReviewCount
    FROM dbo.StallReviews
    WHERE StallId IN (${placeholders.join(", ")})
    GROUP BY StallId;
  `);

  const ratingsByStall = {};
  for (const row of result.recordset) {
    ratingsByStall[row.StallId] = {
      avgRating: Number(row.AvgRating || 0),
      reviewCount: row.ReviewCount || 0,
    };
  }
  return ratingsByStall;
}

module.exports = { getAverageRatingsByStallIds };