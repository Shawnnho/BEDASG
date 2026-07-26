const { sql, poolPromise } = require("../dbConfig");

async function getStallOwnerEmail(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT u.Email
      FROM dbo.Stalls s
      INNER JOIN dbo.Users u ON s.OwnerUid = u.UserId
      WHERE s.StallId = @stallId
    `);
  return result.recordset[0]?.Email || null;
}

module.exports = { 
    getStallOwnerEmail 
};