const { sql, poolPromise } = require('../dbConfig');

class SavedCardModel {
    static async getSavedCards(userId) {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('uid', sql.NVarChar(255), userId)
            .query(`
                SELECT SavedCardId, CardBrand, Last4, ExpMonth, ExpYear, CreatedAt, InUse
                FROM dbo.SavedCards
                WHERE UserId = @uid
                ORDER BY CreatedAt DESC
            `);
        return result.recordset;
    }

    static async saveCard(userId, card) {
        const pool = await poolPromise;
        const transaction = pool.transaction();
        
        await transaction.begin();
        try {
            await transaction.request()
                .input('uid', sql.NVarChar(255), userId)
                .query(`
                    UPDATE dbo.SavedCards 
                    SET InUse = 0 
                    WHERE UserId = @uid
                `);

            const result = await transaction.request()
                .input('uid', sql.NVarChar(255), userId)
                .input('brand', sql.NVarChar(20), card.brand)
                .input('last4', sql.Char(4), card.last4)
                .input('expMonth', sql.TinyInt, card.expMonth)
                .input('expYear', sql.SmallInt, card.expYear)
                .query(`
                    INSERT INTO dbo.SavedCards (UserId, CardBrand, Last4, ExpMonth, ExpYear, InUse)
                    OUTPUT INSERTED.SavedCardId
                    VALUES (@uid, @brand, @last4, @expMonth, @expYear, 1)
                `);
            
            await transaction.commit();
            return result.recordset[0].SavedCardId;
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    // New function to swap which card is currently InUse
    static async setActiveCard(userId, savedCardId) {
        const pool = await poolPromise;
        const transaction = pool.transaction();

        await transaction.begin();
        try {
            // Step 1: Turn off all cards for this user
            await transaction.request()
                .input('uid', sql.NVarChar(255), userId)
                .query(`
                    UPDATE dbo.SavedCards 
                    SET InUse = 0 
                    WHERE UserId = @uid
                `);

            // Step 2: Turn on only the selected card
            const result = await transaction.request()
                .input('uid', sql.NVarChar(255), userId)
                .input('id', sql.Int, savedCardId)
                .query(`
                    UPDATE dbo.SavedCards
                    SET InUse = 1
                    WHERE SavedCardId = @id AND UserId = @uid
                `);

            await transaction.commit();
            return result.rowsAffected[0];
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
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