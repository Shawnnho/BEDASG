const { sql, poolPromise } = require("../dbConfig");

async function getAllPromotions() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT * FROM dbo.Promotions
    `);
    return result.recordset;
}

/**
 * Redeems a promo code for a specific user, enforcing "one claim per user
 * per promo" via dbo.UserPromoClaims, inside a single transaction so the
 * RedemptionsLeft counter and the claim record can never drift apart.
 *
 * Returns one of:
 *   { success: true }
 *   { success: false, reason: 'not_found' }
 *   { success: false, reason: 'exhausted' }
 *   { success: false, reason: 'already_claimed' }
 */
async function redeemPromotion(promoCode, userId) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();

    try {
        const promoRes = await transaction.request()
            .input('promoCode', sql.NVarChar(255), promoCode)
            .query(`
                SELECT PromoId, RedemptionsLeft
                FROM dbo.Promotions
                WHERE PromoCode = @promoCode
            `);

        const promo = promoRes.recordset[0];
        if (!promo) {
            await transaction.rollback();
            return { success: false, reason: 'not_found' };
        }

        if (promo.RedemptionsLeft != null && promo.RedemptionsLeft <= 0) {
            await transaction.rollback();
            return { success: false, reason: 'exhausted' };
        }

        const claimRes = await transaction.request()
            .input('userId', sql.NVarChar(255), userId)
            .input('promoId', sql.NVarChar(255), promo.PromoId)
            .query(`
                SELECT ClaimId FROM dbo.UserPromoClaims
                WHERE UserId = @userId AND PromoId = @promoId
            `);

        if (claimRes.recordset.length > 0) {
            await transaction.rollback();
            return { success: false, reason: 'already_claimed' };
        }

        const updateRes = await transaction.request()
            .input('promoId', sql.NVarChar(255), promo.PromoId)
            .query(`
                UPDATE dbo.Promotions
                SET RedemptionsLeft = RedemptionsLeft - 1
                WHERE PromoId = @promoId AND (RedemptionsLeft > 0 OR RedemptionsLeft IS NULL)
            `);

        if (updateRes.rowsAffected[0] === 0) {
            await transaction.rollback();
            return { success: false, reason: 'exhausted' };
        }

        await transaction.request()
            .input('userId', sql.NVarChar(255), userId)
            .input('promoId', sql.NVarChar(255), promo.PromoId)
            .input('promoCode', sql.NVarChar(255), promoCode)
            .query(`
                INSERT INTO dbo.UserPromoClaims (UserId, PromoId, PromoCode, ClaimedAt)
                VALUES (@userId, @promoId, @promoCode, SYSUTCDATETIME())
            `);

        await transaction.commit();
        return { success: true };
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

module.exports = {
    getAllPromotions,
    redeemPromotion
};