// ============================================================
// models/stallClosureModel.js
//
// Data-access layer for the StallClosures table. Every closure belongs
// to exactly one stall (FK -> Stalls.StallId). All queries are scoped by
// StallId so a stallholder can only ever touch their own stall's rows.
//
// Follows the project's pool pattern: `await poolPromise`, then
// pool.request().input(...).query(...).
// ============================================================

const { sql, poolPromise } = require("../dbConfig");

// READ: all closures for a stall, upcoming first.
async function getClosuresByStall(stallId) {
  const pool = await poolPromise;
  const result = await pool.request().input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT
        ClosureId,
        StallId,
        CONVERT(varchar(10), ClosureDate, 23) AS ClosureDate, -- yyyy-mm-dd
        Reason,
        CreatedAt,
        UpdatedAt
      FROM dbo.StallClosures
      WHERE StallId = @stallId
      ORDER BY ClosureDate ASC;
    `);
  return result.recordset;
}

// READ (single): one closure by id, scoped to the owning stall.
async function getClosureById(closureId, stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("closureId", sql.Int, closureId)
    .input("stallId", sql.NVarChar, stallId).query(`
      SELECT
        ClosureId,
        StallId,
        CONVERT(varchar(10), ClosureDate, 23) AS ClosureDate,
        Reason,
        CreatedAt,
        UpdatedAt
      FROM dbo.StallClosures
      WHERE ClosureId = @closureId AND StallId = @stallId;
    `);
  return result.recordset[0] || null;
}

// CREATE: add a closure. Returns the new ClosureId.
// The UNIQUE (StallId, ClosureDate) constraint means a duplicate date
// throws a SQL error (number 2627/2601) — the controller maps that to a
// friendly "already closed on that date" message.
async function addClosure(stallId, closureDate, reason) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .input("closureDate", sql.Date, closureDate)
    .input("reason", sql.NVarChar, reason || null).query(`
      INSERT INTO dbo.StallClosures (StallId, ClosureDate, Reason)
      OUTPUT INSERTED.ClosureId
      VALUES (@stallId, @closureDate, @reason);
    `);
  return result.recordset[0].ClosureId;
}

// UPDATE: change the date and/or reason of an existing closure.
// Scoped to the owning stall. Returns the number of rows affected
// (0 means the closure didn't exist or belonged to another stall).
async function updateClosure(closureId, stallId, closureDate, reason) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("closureId", sql.Int, closureId)
    .input("stallId", sql.NVarChar, stallId)
    .input("closureDate", sql.Date, closureDate)
    .input("reason", sql.NVarChar, reason || null).query(`
      UPDATE dbo.StallClosures
      SET ClosureDate = @closureDate,
          Reason      = @reason,
          UpdatedAt   = SYSUTCDATETIME()
      WHERE ClosureId = @closureId AND StallId = @stallId;
    `);
  return result.rowsAffected[0];
}

// DELETE: remove a closure (i.e. reopen the stall for that date).
// Scoped to the owning stall. Returns rows affected.
async function deleteClosure(closureId, stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("closureId", sql.Int, closureId)
    .input("stallId", sql.NVarChar, stallId).query(`
      DELETE FROM dbo.StallClosures
      WHERE ClosureId = @closureId AND StallId = @stallId;
    `);
  return result.rowsAffected[0];
}

module.exports = {
  getClosuresByStall,
  getClosureById,
  addClosure,
  updateClosure,
  deleteClosure,
};
