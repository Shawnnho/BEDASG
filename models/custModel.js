const { sql, poolPromise } = require("../dbConfig");

async function getCustomer(userId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("UserId", sql.NVarChar(255), userId)
    .query("SELECT * FROM Users WHERE UserId = @UserId");
  return result.recordset;
}

/**
 * Update a customer's name, email, and phone.
 * @param {string} userId
 * @param {{ Name: string, Email: string, Phone: string }} data
 * @returns {Promise<Object|null>} the updated row, or null if no user matched
 */
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

/**
 * Get the stored password hash for a user, from UserCredentials.
 * @param {string} userId
 * @returns {Promise<string|null>} the bcrypt hash, or null if no row exists
 */
async function getPasswordHash(userId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("UserId", sql.NVarChar(255), userId)
    .query("SELECT PasswordHash FROM UserCredentials WHERE UserId = @UserId");

  return result.recordset[0]?.PasswordHash || null;
}

/**
 * Overwrite a user's stored password hash.
 * @param {string} userId
 * @param {string} newPasswordHash - already bcrypt-hashed (never pass a plaintext password here)
 * @returns {Promise<boolean>} true if a row was updated, false if no user matched
 */
async function changePassword(userId, newPasswordHash) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("UserId", sql.NVarChar(255), userId)
    .input("PasswordHash", sql.NVarChar(255), newPasswordHash)
    .query(`
      UPDATE UserCredentials
      SET PasswordHash = @PasswordHash
      WHERE UserId = @UserId
    `);

  return result.rowsAffected[0] > 0;
}

module.exports = { getCustomer, updateProfile, getPasswordHash, changePassword };