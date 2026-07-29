const { sql, poolPromise } = require('../dbConfig');

class SavedCardModel {
    static async getSavedCards(userId) {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('uid', sql.NVarChar(255), userId)
            .query(`
                SELECT SavedCardId, CardBrand, Last4, ExpMonth, ExpYear, CreatedAt
                FROM dbo.SavedCards
                WHERE UserId = @uid
                ORDER BY CreatedAt DESC
            `);
        return result.recordset;
    }

    static async saveCard(userId, card) {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('uid', sql.NVarChar(255), userId)
            .input('brand', sql.NVarChar(20), card.brand)
            .input('last4', sql.Char(4), card.last4)
            .input('expMonth', sql.TinyInt, card.expMonth)
            .input('expYear', sql.SmallInt, card.expYear)
            .query(`
                INSERT INTO dbo.SavedCards (UserId, CardBrand, Last4, ExpMonth, ExpYear)
                OUTPUT INSERTED.SavedCardId
                VALUES (@uid, @brand, @last4, @expMonth, @expYear)
            `);
        return result.recordset[0].SavedCardId;
    }

    static async deleteSavedCard(userId, savedCardId) {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('uid', sql.NVarChar(255), userId)
            .input('id', sql.Int, savedCardId)
            .query(`
                DELETE FROM dbo.SavedCards
                WHERE SavedCardId = @id AND UserId = @uid
            `);
        return result.rowsAffected[0];
    }
}

module.exports = SavedCardModel;