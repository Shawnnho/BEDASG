const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");


async function hasUserReported(reviewId, reporterUserId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("reviewId", sql.NVarChar, reviewId)
    .input("reporterUserId", sql.NVarChar, reporterUserId)
    .query(`
      SELECT 1 FROM dbo.FeedbackReports
      WHERE ReviewId = @reviewId AND ReporterUserId = @reporterUserId;
    `);
  return result.recordset.length > 0;
}

async function createReport({ reviewId, reporterUserId, reason, details }) {
  const pool = await poolPromise;
  const reportId = crypto.randomUUID();

  await pool
    .request()
    .input("reportId", sql.NVarChar, reportId)
    .input("reviewId", sql.NVarChar, reviewId)
    .input("reporterUserId", sql.NVarChar, reporterUserId)
    .input("reason", sql.NVarChar, reason)
    .input("details", sql.NVarChar, details || null)
    .query(`
      INSERT INTO dbo.FeedbackReports (ReportId, ReviewId, ReporterUserId, Reason, Details, CreatedAt)
      VALUES (@reportId, @reviewId, @reporterUserId, @reason, @details, GETDATE());
    `);

  return { reportId };
}

module.exports = { 
    hasUserReported, createReport
};