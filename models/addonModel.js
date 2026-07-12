const { sql, poolPromise } = require("../dbConfig");

async function getAddonsByStall(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .query("SELECT Label, Active, StallId, AddonId, Price FROM StallAddons WHERE StallId = @stallId ORDER BY Name");
  return result.recordset;
}



module.exports = { getAddonsByStall };
