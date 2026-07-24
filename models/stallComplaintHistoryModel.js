const { sql, poolPromise } = require("../dbConfig");

async function getComplaintsByStall(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT ComplaintId, UserName, ComplaintType, Message, Status, CreatedAt
      FROM dbo.Complaints
      WHERE Stall = @stallId
      ORDER BY CreatedAt DESC;
    `);
  return result.recordset;
}

module.exports = { getComplaintsByStall };