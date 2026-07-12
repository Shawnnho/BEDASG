const { poolPromise, sql } = require("../dbConfig");

// Statuses that count as "real" orders (money changed hands or will)
const COUNTED = ["paid", "processing", "preparing", "ready", "completed"];
const COUNTED_LIST = COUNTED.map((s) => `'${s}'`).join(",");

/* ===================== KPIs ===================== */

async function getKpis(stallId, start, end) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("StallId", sql.NVarChar(255), stallId)
    .input("Start", sql.DateTime2, start)
    .input("End", sql.DateTime2, end).query(`
      SELECT
        COUNT(*) AS OrderCount,
        SUM(CASE WHEN OrderStatus = 'completed'
                 THEN ISNULL(TotalAmount, 0) ELSE 0 END) AS TotalSales,
        SUM(CASE WHEN OrderStatus = 'completed' THEN 1 ELSE 0 END) AS CompletedCount
      FROM Orders
      WHERE StallId = @StallId
        AND CreatedAt >= @Start
        AND CreatedAt <= @End
        AND OrderStatus IN (${COUNTED_LIST});
    `);

  const r = result.recordset[0] || {};
  const orders = r.OrderCount || 0;
  const completed = r.CompletedCount || 0;

  return {
    orderCount: orders,
    totalSales: Number(r.TotalSales || 0),
    completedCount: completed,
    completionRate: orders > 0 ? Math.round((completed / orders) * 100) : 0,
  };
}

/* ===================== CHART SERIES ===================== */

// Hourly buckets (for single-day presets)
async function getHourlySales(stallId, start, end) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("StallId", sql.NVarChar(255), stallId)
    .input("Start", sql.DateTime2, start)
    .input("End", sql.DateTime2, end).query(`
      SELECT
        DATEPART(HOUR, CreatedAt) AS Bucket,
        SUM(ISNULL(TotalAmount, 0)) AS Sales,
        COUNT(*) AS Orders
      FROM Orders
      WHERE StallId = @StallId
        AND CreatedAt >= @Start
        AND CreatedAt <= @End
        AND OrderStatus IN (${COUNTED_LIST})
      GROUP BY DATEPART(HOUR, CreatedAt)
      ORDER BY Bucket;
    `);
  return result.recordset.map((r) => ({
    bucket: r.Bucket,
    sales: Number(r.Sales || 0),
    orders: r.Orders || 0,
  }));
}

// Daily buckets (for multi-day ranges)
async function getDailySales(stallId, start, end) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("StallId", sql.NVarChar(255), stallId)
    .input("Start", sql.DateTime2, start)
    .input("End", sql.DateTime2, end).query(`
      SELECT
        CAST(CreatedAt AS DATE) AS Bucket,
        SUM(ISNULL(TotalAmount, 0)) AS Sales,
        COUNT(*) AS Orders
      FROM Orders
      WHERE StallId = @StallId
        AND CreatedAt >= @Start
        AND CreatedAt <= @End
        AND OrderStatus IN (${COUNTED_LIST})
      GROUP BY CAST(CreatedAt AS DATE)
      ORDER BY Bucket;
    `);
  return result.recordset.map((r) => ({
    bucket: r.Bucket, // Date
    sales: Number(r.Sales || 0),
    orders: r.Orders || 0,
  }));
}

/* ===================== TOP DISHES ===================== */

async function getTopDishes(stallId, start, end, topN = 5) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("StallId", sql.NVarChar(255), stallId)
    .input("Start", sql.DateTime2, start)
    .input("End", sql.DateTime2, end)
    .input("TopN", sql.Int, topN).query(`
      SELECT TOP (@TopN)
        oi.ItemName,
        SUM(ISNULL(oi.Quantity, 0))  AS Qty,
        SUM(ISNULL(oi.LineTotal, 0)) AS Revenue
      FROM OrderItems oi
      JOIN Orders o ON o.OrderId = oi.OrderId
      WHERE o.StallId = @StallId
        AND o.CreatedAt >= @Start
        AND o.CreatedAt <= @End
        AND o.OrderStatus IN (${COUNTED_LIST})
        AND oi.ItemName IS NOT NULL
      GROUP BY oi.ItemName
      ORDER BY Qty DESC, Revenue DESC;
    `);
  return result.recordset.map((r) => ({
    name: r.ItemName,
    qty: r.Qty || 0,
    revenue: Number(r.Revenue || 0),
  }));
}

/* ===================== RATINGS ===================== */

async function getRatings(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("StallId", sql.NVarChar(255), stallId).query(`
      SELECT Rating, COUNT(*) AS Cnt
      FROM StallReviews
      WHERE StallId = @StallId
        AND Rating BETWEEN 1 AND 5
      GROUP BY Rating;
    `);

  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;

  for (const r of result.recordset) {
    counts[r.Rating] = r.Cnt;
    total += r.Cnt;
    sum += r.Rating * r.Cnt;
  }

  return {
    avg: total > 0 ? Number((sum / total).toFixed(1)) : 0,
    total,
    counts,
  };
}

/* ===================== HYGIENE ===================== */

async function getHygiene(stallId) {
  const pool = await poolPromise;

  // Next scheduled inspection
  const next = await pool.request().input("StallId", sql.NVarChar(255), stallId)
    .query(`
      SELECT TOP 1 InspectionId, InspectionDate, DateTs, OfficerName
      FROM HygieneInspections
      WHERE StallId = @StallId
        AND InspectionStatus = 'scheduled'
        AND DateTs >= SYSUTCDATETIME()
      ORDER BY DateTs ASC;
    `);

  // Most recent completed inspection (for the grade)
  const last = await pool.request().input("StallId", sql.NVarChar(255), stallId)
    .query(`
      SELECT TOP 1 InspectionGrade, InspectionScore, InspectionDate,
                   CompletedAt, DateTs
      FROM HygieneInspections
      WHERE StallId = @StallId
        AND InspectionStatus = 'completed'
      ORDER BY DateTs DESC;
    `);

  const n = next.recordset[0];
  const l = last.recordset[0];

  return {
    nextInspection: n
      ? {
          date: n.InspectionDate,
          dateTs: n.DateTs,
          officer: n.OfficerName || "",
        }
      : null,
    lastInspection: l
      ? {
          grade: l.InspectionGrade || "",
          score: l.InspectionScore,
          date: l.InspectionDate,
          completedAt: l.CompletedAt,
        }
      : null,
  };
}

module.exports = {
  getKpis,
  getHourlySales,
  getDailySales,
  getTopDishes,
  getRatings,
  getHygiene,
};
