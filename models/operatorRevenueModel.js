const { sql, poolPromise } = require("../dbConfig");

// Revenue for a single centre
async function getCompletedRevenueByCentre(centreId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("centreId", sql.NVarChar, centreId)
    .query(`
      SELECT ISNULL(SUM(TotalAmount), 0) AS Revenue
      FROM dbo.Orders
      WHERE CentreId = @centreId
        AND OrderStatus = 'completed';
    `);
  return Number(result.recordset[0].Revenue || 0);
}


async function getCompletedRevenueByCentreIds(centreIds) {
  if (!centreIds || centreIds.length === 0) return {};

  const pool = await poolPromise;
  const request = pool.request();

  const placeholders = centreIds.map((id, i) => {
    const paramName = `centreId${i}`;
    request.input(paramName, sql.NVarChar, id);
    return `@${paramName}`;
  });

  const result = await request.query(`
    SELECT CentreId, ISNULL(SUM(TotalAmount), 0) AS Revenue
    FROM dbo.Orders
    WHERE OrderStatus = 'completed'
      AND CentreId IN (${placeholders.join(", ")})
    GROUP BY CentreId;
  `);

  const revenueByCentre = {};
  for (const row of result.recordset) {
    revenueByCentre[row.CentreId] = Number(row.Revenue || 0);
  }
  return revenueByCentre;
}

async function getCompletedRevenueByStallIds(stallIds) {
  if (!stallIds || stallIds.length === 0) return {};

  const pool = await poolPromise;
  const request = pool.request();

  const placeholders = stallIds.map((id, i) => {
    const paramName = `stallId${i}`;
    request.input(paramName, sql.NVarChar, id);
    return `@${paramName}`;
  });

  const result = await request.query(`
    SELECT StallId, ISNULL(SUM(TotalAmount), 0) AS Revenue
    FROM dbo.Orders
    WHERE OrderStatus = 'completed'
      AND StallId IN (${placeholders.join(", ")})
    GROUP BY StallId;
  `);

  const revenueByStall = {};
  for (const row of result.recordset) {
    revenueByStall[row.StallId] = Number(row.Revenue || 0);
  }
  return revenueByStall;
}

module.exports = {
  getCompletedRevenueByCentre,
  getCompletedRevenueByCentreIds,
  getCompletedRevenueByStallIds,
};