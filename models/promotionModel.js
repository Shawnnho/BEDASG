const { poolPromise } = require("../dbConfig");

class Promotion {
  static async getAllPromotions() {
    const pool = await poolPromise;
    const query = `
            SELECT
                [PromotionId] AS id,
                [PromoTitle]  AS title,
                [Desc]        AS [desc],
                [PromoCode]   AS code,
                [ImageUrl]    AS img,
                [IsPopular]   AS popular,
                [ExpiresAt]   AS expiresAt
            FROM Promotions
            WHERE [ExpiresAt] >= GETDATE()
        `;
    const result = await pool.request().query(query);
    return result.recordset;
  }
}

module.exports = Promotion;
