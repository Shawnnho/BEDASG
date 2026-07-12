const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");

/* ========== STALLS (for dropdowns + grading overview) ========== */

async function getAllActiveStalls() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT StallId, StallName, HygieneGrade
    FROM dbo.Stalls
    WHERE IsActive = 1
    ORDER BY StallName
  `);
  return result.recordset;
}

async function getStallById(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .query("SELECT StallId, StallName, HygieneGrade FROM dbo.Stalls WHERE StallId = @stallId");
  return result.recordset[0] || null;
}

async function updateStallGrade(stallId, grade) {
  const pool = await poolPromise;
  await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .input("grade", sql.NVarChar, grade)
    .query(`
      UPDATE dbo.Stalls
      SET HygieneGrade = @grade, LastInspection = SYSUTCDATETIME()
      WHERE StallId = @stallId
    `);
}

async function updateStallGradeAndLicense(stallId, grade, licenseIssued, licenseExpiry) {
  const pool = await poolPromise;
  const request = pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .input("grade", sql.NVarChar, grade);

  let setClause = "HygieneGrade = @grade, LastInspection = SYSUTCDATETIME()";
  if (licenseIssued && licenseExpiry) {
    request.input("licenseIssued", sql.DateTime2, licenseIssued);
    request.input("licenseExpiry", sql.DateTime2, licenseExpiry);
    setClause += ", LicenseIssued = @licenseIssued, LicenseExpiry = @licenseExpiry";
  }

  await request.query(`UPDATE dbo.Stalls SET ${setClause} WHERE StallId = @stallId`);
}

/* ========== INSPECTIONS ========== */

async function getAllInspections() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT InspectionId, StallId, StallName, OfficerName, InspectionStatus,
           InspectionGrade, InspectionScore, Remarks, BreakdownJson,
           InspectionDate, DateTs, CreatedAt, CompletedAt, CancelledAt
    FROM dbo.HygieneInspections
    ORDER BY DateTs DESC
  `);
  return result.recordset;
}

async function getInspectionById(inspectionId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("id", sql.NVarChar, inspectionId)
    .query("SELECT * FROM dbo.HygieneInspections WHERE InspectionId = @id");
  return result.recordset[0] || null;
}

async function createScheduledInspection({ stallId, stallName, date, officer }) {
  const pool = await poolPromise;
  const inspectionId = crypto.randomUUID();

  await pool
    .request()
    .input("id", sql.NVarChar, inspectionId)
    .input("stallId", sql.NVarChar, stallId)
    .input("stallName", sql.NVarChar, stallName)
    .input("officer", sql.NVarChar, officer)
    .input("date", sql.NVarChar, date)
    .input("dateTs", sql.DateTime2, new Date(`${date}T00:00:00`))
    .query(`
      INSERT INTO dbo.HygieneInspections
        (InspectionId, StallId, StallName, OfficerName, InspectionStatus, InspectionDate, DateTs, CreatedAt)
      VALUES
        (@id, @stallId, @stallName, @officer, 'scheduled', @date, @dateTs, SYSUTCDATETIME())
    `);

  return await getInspectionById(inspectionId);
}

async function cancelInspection(inspectionId) {
  const pool = await poolPromise;
  await pool
    .request()
    .input("id", sql.NVarChar, inspectionId)
    .query(`
      UPDATE dbo.HygieneInspections
      SET InspectionStatus = 'cancelled', CancelledAt = SYSUTCDATETIME()
      WHERE InspectionId = @id AND InspectionStatus = 'scheduled'
    `);
}

async function completeInspection(
  inspectionId,
  { officer, date, score, grade, remarks, breakdownJson },
) {
  const pool = await poolPromise;
  await pool
    .request()
    .input("id", sql.NVarChar, inspectionId)
    .input("officer", sql.NVarChar, officer)
    .input("date", sql.NVarChar, date)
    .input("dateTs", sql.DateTime2, new Date(`${date}T00:00:00`))
    .input("score", sql.Int, score)
    .input("grade", sql.NVarChar, grade)
    .input("remarks", sql.NVarChar, remarks || null)
    .input("breakdownJson", sql.NVarChar, breakdownJson)
    .query(`
      UPDATE dbo.HygieneInspections
      SET InspectionStatus = 'completed',
          OfficerName = @officer,
          InspectionDate = @date,
          DateTs = @dateTs,
          InspectionScore = @score,
          InspectionGrade = @grade,
          Remarks = @remarks,
          BreakdownJson = @breakdownJson,
          CompletedAt = SYSUTCDATETIME()
      WHERE InspectionId = @id
    `);

  return await getInspectionById(inspectionId);
}

/* ========== COMPLAINTS ========== */

async function getAllComplaints() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT ComplaintId, Uid, UserName, FirstName, LastName, Email,
           Stall, StallName, ComplaintType, Message, ImageUrl,
           [Status], CreatedAt, UpdatedAt
    FROM dbo.Complaints
    ORDER BY CreatedAt DESC
  `);
  return result.recordset;
}

async function updateComplaintStatus(complaintId, status) {
  const pool = await poolPromise;
  await pool
    .request()
    .input("id", sql.NVarChar, complaintId)
    .input("status", sql.NVarChar, status)
    .query(`
      UPDATE dbo.Complaints
      SET [Status] = @status, UpdatedAt = SYSUTCDATETIME()
      WHERE ComplaintId = @id
    `);
}

module.exports = {
  getAllActiveStalls,
  getStallById,
  updateStallGrade,
  updateStallGradeAndLicense,
  getAllInspections,
  getInspectionById,
  createScheduledInspection,
  cancelInspection,
  completeInspection,
  getAllComplaints,
  updateComplaintStatus,
};
