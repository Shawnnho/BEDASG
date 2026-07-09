const { sql, poolPromise } = require("../dbConfig");



async function addFavStall(userid, stallid) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("userId", sql.nvarchar(255), userid)
    .input("stallId", sql.nvarchar(255), stallid)
    .query("INSERT INTO UserFavouriteStalls (userId, stallId) VALUES (@userId, @stallId)");
  return result.recordset[0];
}

async function deleteFavStall(userid, stallid) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("userId", sql.nvarchar(255), userid)
    .input("stallId", sql.nvarchar(255), stallid)
    .query("DELETE FROM UserFavouriteStalls WHERE userId = @userId AND stallId = @stallId");
  return result.recordset[0];
}



module.exports = {
  addFavStall,
  deleteFavStall
};
