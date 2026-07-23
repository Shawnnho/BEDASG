const { sql, poolPromise } = require("../dbConfig");

async function getAllPromotions() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT * FROM dbo.Promotions
    `);
    return result.recordset;
}

async function redeemPromotion(promoCode) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('promoCode', sql.VarChar, promoCode)
        .query(`
            UPDATE dbo.Promotions
            SET RedemptionsLeft = RedemptionsLeft - 1
            WHERE PromoCode = @promoCode AND RedemptionsLeft > 0
        `);
    return result.rowsAffected[0] > 0;
}

module.exports = {
    getAllPromotions,
    redeemPromotion
};