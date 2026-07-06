const { sql, poolPromise } = require("../dbConfig");

async function getAllCentres() {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .query("SELECT CentreId, Name, ImagePath FROM Centres ORDER BY Name");
  return result.recordset;
}

async function getCentreById(centreId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("centreId", sql.NVarChar, centreId)
    .query(
      "SELECT CentreId, Name, ImagePath FROM Centres WHERE CentreId = @centreId",
    );
  return result.recordset[0];
}

module.exports = { getAllCentres, getCentreById };
