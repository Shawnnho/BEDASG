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
 * Update a customer's name, email, phone, and (optionally) avatar.
 * @param {string} userId
 * @param {{ Name: string, Email: string, Phone: string, AvatarUrl?: string|null }} data
 *   AvatarUrl is optional - pass null/undefined to leave the existing avatar untouched
 *   (e.g. the user updated their name but didn't upload a new photo). It's stored as a
 *   base64 data URL (e.g. "data:image/png;base64,...") rather than a short file path,
 *   hence NVARCHAR(MAX) instead of NVARCHAR(255) - a base64-encoded image is much
 *   larger than a typical URL and would otherwise be truncated or rejected.
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
    .input("AvatarUrl", sql.NVarChar(sql.MAX), data.AvatarUrl || null)
    .query(`
      UPDATE Users
      SET Name = @Name,
          Email = @Email,
          Phone = @Phone,
          AvatarUrl = COALESCE(@AvatarUrl, AvatarUrl)
      OUTPUT INSERTED.UserId, INSERTED.Name, INSERTED.Email, INSERTED.Phone, INSERTED.AvatarUrl
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