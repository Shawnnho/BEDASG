const { sql, poolPromise } = require("../dbConfig");

async function getAllStalls() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT
      s.StallId,
      s.CentreId,
      s.StallName,
      s.Cuisine,
      s.HygieneGrade,
      s.PrepMin,
      s.PrepMax,
      s.IsPopular,
      s.ImageUrl,
      s.[Desc],
      s.UnitNo,
      c.Name AS CentreName
    FROM dbo.Stalls s
    INNER JOIN dbo.Centres c ON s.CentreId = c.CentreId
    WHERE s.IsActive = 1
      AND s.IsCanonical = 1
    ORDER BY s.StallName;
  `);
  return result.recordset;
}

module.exports = { getAllStalls };
