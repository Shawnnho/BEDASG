const { sql, poolPromise } = require("../dbConfig");

async function getAllPromotions() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT 
            PromotionId,
            PromoCode,
            PromoTitle,
            [Desc],
            PromoType,
            ImageUrl,
            RedemptionsLeft,
            ClaimOnce,
            IsPopular,
            ExpiresAt
        FROM dbo.Promotions
    `);
    return result.recordset;
}

module.exports = {
    getAllPromotions
};