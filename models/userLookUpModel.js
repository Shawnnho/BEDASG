const { sql, poolPromise } = require("../dbConfig");

async function getUserEmail(userId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("userId", sql.NVarChar, userId)
    .query("SELECT Email FROM dbo.Users WHERE UserId = @userId");
  return result.recordset[0]?.Email || null;
}

module.exports = { getUserEmail };