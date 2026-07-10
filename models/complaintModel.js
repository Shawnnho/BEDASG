const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");

/*
  dbo.Complaints columns (confirmed from SSMS):
    ComplaintId    NVARCHAR  (PK)
    Uid            NVARCHAR
    FirstName      NVARCHAR
    LastName       NVARCHAR
    UserName       NVARCHAR
    Email          NVARCHAR
    Stall          NVARCHAR   -- StallId
    StallName      NVARCHAR
    ComplaintType  NVARCHAR  (nullable)
    Message        NVARCHAR
    ImagePath      NVARCHAR  (nullable)
    ImageUrl       NVARCHAR  (nullable)
    Status         NVARCHAR   -- "under_review" | "resolved"
    CreatedAt      DATETIME
    UpdatedAt      DATETIME  (nullable)
*/

async function createComplaint({
  uid,
  firstName,
  lastName,
  userName,
  email,
  stall,
  stallName,
  message,
  imagePath,
  imageUrl,
}) {
  const pool = await poolPromise;
  const complaintId = crypto.randomUUID();

  await pool
    .request()
    .input("complaintId", sql.NVarChar, complaintId)
    .input("uid", sql.NVarChar, uid)
    .input("firstName", sql.NVarChar, firstName)
    .input("lastName", sql.NVarChar, lastName)
    .input("userName", sql.NVarChar, userName)
    .input("email", sql.NVarChar, email)
    .input("stall", sql.NVarChar, stall)
    .input("stallName", sql.NVarChar, stallName)
    .input("message", sql.NVarChar, message)
    .input("imagePath", sql.NVarChar, imagePath || null)
    .input("imageUrl", sql.NVarChar, imageUrl || null)
    .query(`
      INSERT INTO dbo.Complaints
        (ComplaintId, Uid, FirstName, LastName, UserName, Email, Stall, StallName,
         ComplaintType, Message, ImagePath, ImageUrl, Status, CreatedAt, UpdatedAt)
      VALUES
        (@complaintId, @uid, @firstName, @lastName, @userName, @email, @stall, @stallName,
         'complaint', @message, @imagePath, @imageUrl, 'under_review', GETDATE(), NULL);
    `);

  return { complaintId };
}

async function getComplaintsByUser(uid) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("uid", sql.NVarChar, uid)
    .query(`
      SELECT
        ComplaintId, Uid, FirstName, LastName, UserName, Email, Stall, StallName,
        ComplaintType, Message, ImagePath, ImageUrl, Status, CreatedAt, UpdatedAt
      FROM dbo.Complaints
      WHERE Uid = @uid
      ORDER BY CreatedAt DESC;
    `);
  return result.recordset;
}

async function getComplaintById(complaintId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("complaintId", sql.NVarChar, complaintId)
    .query("SELECT * FROM dbo.Complaints WHERE ComplaintId = @complaintId");
  return result.recordset[0] || null;
}

module.exports = { createComplaint, getComplaintsByUser, getComplaintById };