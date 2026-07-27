const { sql, poolPromise } = require("../dbConfig");

async function createRefreshToken(userId, tokenHash, expiresAt) {
  const pool = await poolPromise;
  await pool
    .request()
    .input("userId", sql.NVarChar, userId)
    .input("tokenHash", sql.NVarChar, tokenHash)
    .input("expiresAt", sql.DateTime2, expiresAt)
    .query(`
      INSERT INTO dbo.RefreshTokens (UserId, TokenHash, ExpiresAt)
      VALUES (@userId, @tokenHash, @expiresAt)
    `);
}

// Only returns a row if it exists, isn't revoked, and hasn't expired
async function findValidRefreshToken(tokenHash) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("tokenHash", sql.NVarChar, tokenHash)
    .query(`
      SELECT * FROM dbo.RefreshTokens
      WHERE TokenHash = @tokenHash
        AND RevokedAt IS NULL
        AND ExpiresAt > SYSUTCDATETIME()
    `);
  return result.recordset[0] || null;
}

// Atomically validates AND revokes a refresh token in one statement, so two
// near-simultaneous refresh requests carrying the same cookie can't both
// pass validation before either has revoked it (that race let a single
// rotating refresh token be used twice). Returns the claimed row, or null
// if it didn't exist / was already revoked / had expired.
async function claimRefreshToken(tokenHash) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("tokenHash", sql.NVarChar, tokenHash)
    .query(`
      UPDATE dbo.RefreshTokens
      SET RevokedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE TokenHash = @tokenHash AND RevokedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()
    `);
  return result.recordset[0] || null;
}

async function revokeRefreshToken(tokenHash) {
  const pool = await poolPromise;
  await pool
    .request()
    .input("tokenHash", sql.NVarChar, tokenHash)
    .query(`
      UPDATE dbo.RefreshTokens
      SET RevokedAt = SYSUTCDATETIME()
      WHERE TokenHash = @tokenHash AND RevokedAt IS NULL
    `);
}

// Optional extra: call this if you ever detect a revoked/expired refresh
// token being reused — a strong signal it was stolen — to kill every
// session for that user, not just the one that got caught.
async function revokeAllForUser(userId) {
  const pool = await poolPromise;
  await pool
    .request()
    .input("userId", sql.NVarChar, userId)
    .query(`
      UPDATE dbo.RefreshTokens
      SET RevokedAt = SYSUTCDATETIME()
      WHERE UserId = @userId AND RevokedAt IS NULL
    `);
}

module.exports = {
  createRefreshToken,
  findValidRefreshToken,
  claimRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
};
