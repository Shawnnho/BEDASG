const { sql, poolPromise } = require("../dbConfig");

async function getFavStalls(userid) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("userId", sql.NVarChar(255), userid)
    .query("SELECT StallId FROM UserFavouriteStalls WHERE UserId = @userId");
  return result.recordset;
}

async function addFavStall(userid, stallid) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("userId", sql.NVarChar(255), userid)
    .input("stallId", sql.NVarChar(255), stallid)
    .query(
      "INSERT INTO UserFavouriteStalls (UserId, StallId) VALUES (@userId, @stallId)",
    );
  return result.rowsAffected[0] > 0;
}

async function deleteFavStall(userid, stallid) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("userId", sql.NVarChar(255), userid)
    .input("stallId", sql.NVarChar(255), stallid)
    .query(
      "DELETE FROM UserFavouriteStalls WHERE UserId = @userId AND StallId = @stallId",
    );
  return result.rowsAffected[0] > 0;
}

module.exports = {
  getFavStalls,
  addFavStall,
  deleteFavStall,
};