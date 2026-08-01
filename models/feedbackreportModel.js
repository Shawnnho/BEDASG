const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");

// Checks if the user has reported
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
// Creates a report to a review that the user has selected
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

// Retrieve all reports on reviews 
async function getReportsForCentres(centreIds) {
  if (!centreIds || centreIds.length === 0) return [];

  const pool = await poolPromise;
  const request = pool.request();

  const placeholders = centreIds.map((id, i) => {
    const paramName = `centreId${i}`;
    request.input(paramName, sql.NVarChar, id);
    return `@${paramName}`;
  });

  const result = await request.query(`
    SELECT
      fr.ReportId, fr.ReviewId, fr.ReporterUserId, fr.Reason, fr.Details,
      fr.CreatedAt AS ReportedAt,
      r.StallId, r.UserName AS ReviewerName, r.Rating, r.ReviewText,
      r.CreatedAt AS ReviewCreatedAt,
      s.StallName, s.CentreId
    FROM dbo.FeedbackReports fr
    INNER JOIN dbo.StallReviews r ON fr.ReviewId = r.ReviewId
    INNER JOIN dbo.Stalls s ON r.StallId = s.StallId
    WHERE s.CentreId IN (${placeholders.join(", ")})
    ORDER BY fr.CreatedAt DESC;
  `);

  return result.recordset;
}

async function getReportById(reportId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("reportId", sql.NVarChar, reportId)
    .query("SELECT * FROM dbo.FeedbackReports WHERE ReportId = @reportId");
  return result.recordset[0] || null;
}
//  Dismisses the Report 
async function dismissReport(reportId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("reportId", sql.NVarChar, reportId)
    .query("DELETE FROM dbo.FeedbackReports WHERE ReportId = @reportId");
  return result.rowsAffected[0] > 0;
}
// Deletes the review  that the operator has selected 
async function deleteReportsByReviewId(reviewId) {
  const pool = await poolPromise;
  await pool
    .request()
    .input("reviewId", sql.NVarChar, reviewId)
    .query("DELETE FROM dbo.FeedbackReports WHERE ReviewId = @reviewId");
}

module.exports = {
  hasUserReported,
  createReport,
  getReportsForCentres,
  getReportById,
  dismissReport,
  deleteReportsByReviewId,
};