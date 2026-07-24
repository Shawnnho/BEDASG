const { sql, poolPromise } = require("../dbConfig");

async function getItemPrices(menuId) {
    const pool = await poolPromise;
    const result = await pool
        .request()
        .input("menuId", sql.VarChar, menuId)
        .query("SELECT * FROM StallMenuPrices WHERE MenuId = @menuId");
    return result.recordset;
}

module.exports = { getItemPrices };