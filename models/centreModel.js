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
      "SELECT CentreId, Name, ImagePath, Location FROM Centres WHERE CentreId = @centreId",
    );
  return result.recordset[0];
}

async function getCentresByOperator(operatorId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("operatorId", sql.NVarChar, operatorId)
    .query(
      "SELECT CentreId, Name, ImagePath FROM Centres WHERE OperatorId = @operatorId ORDER BY Name",
    );
  return result.recordset;
}

// Returns the centre only if it's owned by this operator
async function getCentreForOperator(centreId, operatorId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("centreId", sql.NVarChar, centreId)
    .input("operatorId", sql.NVarChar, operatorId)
    .query(
      "SELECT CentreId, Name, ImagePath FROM Centres WHERE CentreId = @centreId AND OperatorId = @operatorId",
    );
  return result.recordset[0];
}

module.exports = { getAllCentres, getCentreById, getCentresByOperator, getCentreForOperator };
