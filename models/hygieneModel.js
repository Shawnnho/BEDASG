const { sql, poolPromise } = require("../dbConfig");

async function getStallsForRole(userId, role) {
  const pool = await poolPromise;
  let queryStr = `
    SELECT StallId, StallName, CentreId, HygieneGrade
    FROM dbo.Stalls
    WHERE IsActive = 1
  `;
  const request = pool.request();

  if (role === "storeholder") {
    queryStr += " AND OwnerUid = @userId";
    request.input("userId", sql.NVarChar, userId);
  }

  queryStr += " ORDER BY StallName";
  const result = await request.query(queryStr);
  return result.recordset;
}

async function getStallSummary(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT StallId, StallName, ImageUrl, CentreId, OwnerUid,
             HygieneGrade, LicenseIssued, LicenseExpiry
      FROM dbo.Stalls
      WHERE StallId = @stallId
    `);
  return result.recordset[0] || null;
}

async function getUpcomingInspection(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT TOP 1 InspectionId, OfficerName, InspectionDate, DateTs
      FROM dbo.HygieneInspections
      WHERE StallId = @stallId AND InspectionStatus = 'scheduled'
      ORDER BY DateTs ASC
    `);
  return result.recordset[0] || null;
}

async function getCompletedInspections(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT InspectionId, InspectionGrade, InspectionScore, Remarks,
             BreakdownJson, InspectionDate, DateTs, OfficerName
      FROM dbo.HygieneInspections
      WHERE StallId = @stallId AND InspectionStatus = 'completed'
      ORDER BY DateTs DESC
    `);
  return result.recordset;
}

async function getLatestCompletedScore(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT TOP 1 InspectionScore
      FROM dbo.HygieneInspections
      WHERE StallId = @stallId AND InspectionStatus = 'completed'
      ORDER BY DateTs DESC
    `);
  return result.recordset[0]?.InspectionScore ?? null;
}

async function getCentreStallIds(centreId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("centreId", sql.NVarChar, centreId)
    .query(
      "SELECT StallId FROM dbo.Stalls WHERE CentreId = @centreId AND IsActive = 1",
    );
  return result.recordset.map((r) => r.StallId);
}

module.exports = {
  getStallsForRole,
  getStallSummary,
  getUpcomingInspection,
  getCompletedInspections,
  getLatestCompletedScore,
  getCentreStallIds,
};
