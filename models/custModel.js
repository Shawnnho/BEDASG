const { sql, poolPromise } = require("../dbConfig");

async function getCustomer(userId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("UserId", sql.NVarChar(255), userId)
    .query("SELECT * FROM Users WHERE UserId = @UserId");
  return result.recordset;
}

module.exports = { getCustomer };