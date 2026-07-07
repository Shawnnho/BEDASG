const { poolPromise } = require('../dbConfig');

class Promotion {
    static async getAllPromotions() {
        const pool = await poolPromise;
        const query = `
            SELECT * FROM Promotions 
            WHERE ExpiresAt >= CAST(GETDATE() AS DATETIME)
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    }
}

module.exports = Promotion;