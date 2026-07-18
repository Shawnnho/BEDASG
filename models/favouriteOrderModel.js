const { sql, poolPromise } = require('../dbConfig');

class FavouriteOrderModel {
    static async getFavourite(userId) {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('uid', sql.NVarChar(255), userId)
            .query('SELECT ItemsJson, UpdatedAt FROM dbo.FavouriteOrders WHERE UserId = @uid');

        if (!result.recordset.length) return null;

        let items = [];
        try {
            items = JSON.parse(result.recordset[0].ItemsJson || '[]');
            if (!Array.isArray(items)) items = [];
        } catch {
            items = [];
        }

        return { items, updatedAt: result.recordset[0].UpdatedAt };
    }

    // Upsert — since UserId is the primary key, this always leaves exactly
    // one row per account: update it if it exists, insert it if it doesn't.
    static async saveFavourite(userId, items) {
        const pool = await poolPromise;
        const itemsJson = JSON.stringify(items || []);

        const updateResult = await pool.request()
            .input('uid', sql.NVarChar(255), userId)
            .input('items', sql.NVarChar(sql.MAX), itemsJson)
            .query(`
                UPDATE dbo.FavouriteOrders
                SET ItemsJson = @items, UpdatedAt = SYSUTCDATETIME()
                WHERE UserId = @uid
            `);

        if (updateResult.rowsAffected[0] === 0) {
            await pool.request()
                .input('uid', sql.NVarChar(255), userId)
                .input('items', sql.NVarChar(sql.MAX), itemsJson)
                .query(`
                    INSERT INTO dbo.FavouriteOrders (UserId, ItemsJson, UpdatedAt)
                    VALUES (@uid, @items, SYSUTCDATETIME())
                `);
        }
    }

    static async deleteFavourite(userId) {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('uid', sql.NVarChar(255), userId)
            .query('DELETE FROM dbo.FavouriteOrders WHERE UserId = @uid');
        return result.rowsAffected[0];
    }
}

module.exports = FavouriteOrderModel;