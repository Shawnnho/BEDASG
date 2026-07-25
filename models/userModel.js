const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");
// Used by REGISTER's duplicate-email check.
// Matches ANY existing Users row — including legacy Firebase-only accounts
// that have no row in UserCredentials yet — so a new signup can't quietly
// create a second account reusing an email that already belongs to someone.
async function getUserByEmail(email) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("email", sql.NVarChar, email)
    .query(
      "SELECT UserId, Name, Email, Phone, UserRole FROM dbo.Users WHERE Email = @email",
    );
  return result.recordset[0] || null;
}
// Used by LOGIN. Only returns a result if the user both exists AND has a
// local password set — legacy Firebase-only accounts correctly fail login
// here (they have no UserCredentials row), rather than the app pretending
// they have a password that doesn't exist.
async function getUserWithCredentialsByEmail(email) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("email", sql.NVarChar, email)
    .query(`
      SELECT u.UserId, u.Name, u.Email, u.Phone, u.UserRole,
             u.IsDeactivated, u.DeactivatedAt, c.PasswordHash
      FROM dbo.Users u
      INNER JOIN dbo.UserCredentials c ON c.UserId = u.UserId
      WHERE u.Email = @email
    `);
  return result.recordset[0] || null;
}
async function getUserById(userId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("userId", sql.NVarChar, userId)
    .query(
      "SELECT UserId, Name, Email, Phone, UserRole, CentreId, CreatedAt FROM dbo.Users WHERE UserId = @userId",
    );
  return result.recordset[0] || null;
}
// Inserts into BOTH Users and UserCredentials, wrapped in a transaction so
// a failure partway through can't leave a profile with no password or vice versa.
async function createUser({ name, email, phone, passwordHash, role }) {
  const pool = await poolPromise;
  const userId = crypto.randomUUID();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx)
      .input("userId", sql.NVarChar, userId)
      .input("name", sql.NVarChar, name)
      .input("email", sql.NVarChar, email)
      .input("phone", sql.NVarChar, phone || null)
      .input("role", sql.NVarChar, role)
      .query(`
        INSERT INTO dbo.Users (UserId, Name, Email, Phone, UserRole, CreatedAt, UpdatedAt)
        VALUES (@userId, @name, @email, @phone, @role, SYSUTCDATETIME(), SYSUTCDATETIME())
      `);
    await new sql.Request(tx)
      .input("userId", sql.NVarChar, userId)
      .input("passwordHash", sql.NVarChar, passwordHash)
      .query(`
        INSERT INTO dbo.UserCredentials (UserId, PasswordHash)
        VALUES (@userId, @passwordHash)
      `);
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
  return await getUserById(userId);
}
module.exports = {
  getUserByEmail,
  getUserWithCredentialsByEmail,
  getUserById,
  createUser,
};