const { sql, poolPromise } = require("../dbConfig");

async function getMenuItems(stallId) {
    const pool = await poolPromise;
    const result = await pool
        .request()
        .input("stallId", sql.VarChar, stallId)
        .query("SELECT * FROM StallMenus WHERE StallId = @stallId");
    return result.recordset;
}

module.exports = { getMenuItems };