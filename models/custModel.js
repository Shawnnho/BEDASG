const { sql, poolPromise } = require("../dbConfig");

async function getCustomer(userId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("UserId", sql.NVarChar(255), userId)
    .query("SELECT * FROM Users WHERE UserId = @UserId");
  return result.recordset;
}

async function updateProfile(userId, data) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("UserId", sql.NVarChar(255), userId)
    .input("Name", sql.NVarChar(255), data.Name)
    .input("Email", sql.NVarChar(255), data.Email)
    .input("Phone", sql.NVarChar(255), data.Phone)
    .query(`
      UPDATE Users
      SET Name = @Name,
          Email = @Email,
          Phone = @Phone
      OUTPUT INSERTED.UserId, INSERTED.Name, INSERTED.Email, INSERTED.Phone
      WHERE UserId = @UserId
    `);
 
  return result.recordset[0] || null;
}
 
module.exports = { getCustomer, updateProfile };