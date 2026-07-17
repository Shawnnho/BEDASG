const sql = require('mssql');
const { poolPromise } = require('../dbConfig');

/**
 * Get all favourite menu items for a given user
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getFavouriteMenuItems(userId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('UserId', sql.NVarChar(255), userId)
        .query(`
            SELECT UserId, MenuId, CreatedAt
            FROM UserFavouriteMenuItems
            WHERE UserId = @UserId
            ORDER BY CreatedAt DESC
        `);

    return result.recordset;
}

/**
 * Create a new favourite menu item
 * @param {string} userId
 * @param {string} menuId
 * @returns {Promise<Object>} the newly created row
 */
async function createFavouriteMenuItem(userId, menuId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('UserId', sql.NVarChar(255), userId)
        .input('MenuId', sql.NVarChar(255), menuId)
        .query(`
            INSERT INTO UserFavouriteMenuItems (UserId, MenuId, CreatedAt)
            OUTPUT INSERTED.UserId, INSERTED.MenuId, INSERTED.CreatedAt
            VALUES (@UserId, @MenuId, SYSUTCDATETIME())
        `);

    return result.recordset[0];
}

/**
 * Delete an existing favourite menu item
 * @param {string} userId
 * @param {string} menuId
 * @returns {Promise<number>} number of rows deleted
 */
async function deleteFavouriteMenuItem(userId, menuId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('UserId', sql.NVarChar(255), userId)
        .input('MenuId', sql.NVarChar(255), menuId)
        .query(`
            DELETE FROM UserFavouriteMenuItems
            WHERE UserId = @UserId AND MenuId = @MenuId
        `);

    return result.rowsAffected[0];
}

/**
 * Get like counts for a batch of menu items in one query.
 * @param {string[]} menuIds
 * @returns {Promise<Array<{MenuId: string, LikeCount: number}>>}
 */
async function getFavouriteCounts(menuIds) {
    const pool = await poolPromise;
    const idsCsv = menuIds.join(',');

    const result = await pool.request()
        .input('MenuIds', sql.NVarChar(sql.MAX), idsCsv)
        .query(`
            SELECT MenuId, COUNT(*) AS LikeCount
            FROM UserFavouriteMenuItems
            WHERE MenuId IN (SELECT value FROM STRING_SPLIT(@MenuIds, ','))
            GROUP BY MenuId
        `);

    return result.recordset;
}

module.exports = {
    getFavouriteMenuItems,
    createFavouriteMenuItem,
    deleteFavouriteMenuItem,
    getFavouriteCounts
};