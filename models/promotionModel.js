const { sql, poolPromise } = require("../dbConfig");

// ============================================================
// CUSTOMER-FACING (existing — unchanged)
// ============================================================

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
 *   { success: false, reason: 'expired' }
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
        SELECT PromotionId, RedemptionsLeft, ClaimOnce, ExpiresAt
        FROM dbo.Promotions
        WHERE PromoCode = @promoCode
      `);

    const promo = promoRes.recordset[0];
    if (!promo) {
      await transaction.rollback();
      return { success: false, reason: 'not_found' };
    }

    if (promo.ExpiresAt && new Date(promo.ExpiresAt) < new Date()) {
      await transaction.rollback();
      return { success: false, reason: 'expired' };
    }

    if (promo.RedemptionsLeft != null && promo.RedemptionsLeft <= 0) {
      await transaction.rollback();
      return { success: false, reason: 'exhausted' };
    }

    // Only enforce one-claim-per-user when the promo is actually flagged
    // ClaimOnce — otherwise a repeatably-claimable promo would incorrectly
    // block every user after their first redemption.
    if (promo.ClaimOnce) {
      const claimRes = await transaction.request()
        .input('userId', sql.NVarChar(255), userId)
        .input('promoId', sql.NVarChar(255), promo.PromotionId)
        .query(`
          SELECT ClaimId FROM dbo.UserPromoClaims
          WHERE UserId = @userId AND PromoId = @promoId
        `);

      if (claimRes.recordset.length > 0) {
        await transaction.rollback();
        return { success: false, reason: 'already_claimed' };
      }
    }

    const updateRes = await transaction.request()
      .input('promotionId', sql.NVarChar(255), promo.PromotionId)
      .query(`
        UPDATE dbo.Promotions
        SET RedemptionsLeft = RedemptionsLeft - 1
        WHERE PromotionId = @promotionId AND (RedemptionsLeft > 0 OR RedemptionsLeft IS NULL)
      `);

    if (updateRes.rowsAffected[0] === 0) {
      await transaction.rollback();
      return { success: false, reason: 'exhausted' };
    }

    await transaction.request()
      .input('userId', sql.NVarChar(255), userId)
      .input('promoId', sql.NVarChar(255), promo.PromotionId)
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

async function getPromotionsByUserId(userId) {
  const pool = await poolPromise;
  const result = await pool
  .request()
  .input("UserId", sql.NVarChar(255), userId)
  .query(`SELECT * FROM UserPromoClaims pc INNER JOIN Promotions p ON pc.PromoId = p.PromotionId WHERE UserId = @UserId`)
  return result.recordset;
}

async function getPromotionCountByUserId(userId) {
  const pool = await poolPromise;
  const result = await pool
  .request()
  .input("userId", sql.NVarChar(255), userId)
  .query(`SELECT COUNT('ClaimId') AS count FROM UserPromoClaims WHERE UserId = @userId`)
  return result.recordset[0].count;
}

// ============================================================
// STALLHOLDER-FACING (new — manage this stall's own promotions)
// Every query is scoped by StallId so an owner can only ever see or
// modify promotions belonging to their own stall.
// ============================================================

// READ: all promotions for a given stall, newest first.
async function getPromotionsByStall(stallId) {
  const pool = await poolPromise;
  const result = await pool.request().input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT
        PromotionId, PromoCode, PromoTitle, [Desc], PromoType, ImageUrl,
        StallId, RequiredKeyword, RedemptionsLeft, ClaimOnce, IsPopular,
        CONVERT(varchar(10), ExpiresAt, 23) AS ExpiresAt,
        CreatedAt, MinSpend, MaxDiscount, DiscountValue
      FROM dbo.Promotions
      WHERE StallId = @stallId
      ORDER BY CreatedAt DESC;
    `);
  return result.recordset;
}

// READ (single): one promotion by id, scoped to the owning stall.
async function getPromotionByIdForStall(promotionId, stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("promotionId", sql.NVarChar, promotionId)
    .input("stallId", sql.NVarChar, stallId).query(`
      SELECT
        PromotionId, PromoCode, PromoTitle, [Desc], PromoType, ImageUrl,
        StallId, RequiredKeyword, RedemptionsLeft, ClaimOnce, IsPopular,
        CONVERT(varchar(10), ExpiresAt, 23) AS ExpiresAt,
        CreatedAt, MinSpend, MaxDiscount, DiscountValue
      FROM dbo.Promotions
      WHERE PromotionId = @promotionId AND StallId = @stallId;
    `);
  return result.recordset[0] || null;
}

// Generates the next sequential promotion id (p1, p2, p3, ...).
// Reads the current highest numeric suffix and adds one. Retries a few
// times in case two stallholders create a promo at nearly the same
// moment (mirrors the unit-number approach in stallModel).
async function generateNextPromotionId(pool) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await pool.request().query(`
      SELECT MAX(CAST(SUBSTRING(PromotionId, 2, 50) AS INT)) AS maxNum
      FROM dbo.Promotions
      WHERE PromotionId LIKE 'p%'
        AND ISNUMERIC(SUBSTRING(PromotionId, 2, 50)) = 1
    `);
    const next = (result.recordset[0].maxNum || 0) + 1 + attempt;
    const candidate = `p${next}`;

    const exists = await pool
      .request()
      .input("id", sql.NVarChar, candidate)
      .query("SELECT 1 FROM dbo.Promotions WHERE PromotionId = @id");

    if (exists.recordset.length === 0) return candidate;
  }
  throw new Error("Could not generate a unique promotion id");
}

// CREATE: add a promotion for this stall. Returns the new PromotionId.
// StallId and PromotionId are set here, never trusted from the client.
async function addPromotion(stallId, p) {
  const pool = await poolPromise;
  const promotionId = await generateNextPromotionId(pool);

  await pool
    .request()
    .input("promotionId", sql.NVarChar, promotionId)
    .input("stallId", sql.NVarChar, stallId)
    .input("promoCode", sql.NVarChar, p.promoCode)
    .input("promoTitle", sql.NVarChar, p.promoTitle)
    .input("desc", sql.NVarChar, p.desc || null)
    .input("promoType", sql.NVarChar, p.promoType)
    .input("discountValue", sql.Decimal(10, 2), p.discountValue)
    .input("minSpend", sql.Decimal(10, 2), p.minSpend)
    .input("maxDiscount", sql.Decimal(10, 2), p.maxDiscount ?? null)
    .input("redemptionsLeft", sql.Int, p.redemptionsLeft)
    .input("claimOnce", sql.Bit, p.claimOnce ? 1 : 0)
    .input("isPopular", sql.Bit, p.isPopular ? 1 : 0)
    .input("expiresAt", sql.DateTime2, p.expiresAt || null)
    .input("requiredKeyword", sql.NVarChar, p.requiredKeyword || null)
    .input("imageUrl", sql.NVarChar(sql.MAX), p.imageUrl || null).query(`
      INSERT INTO dbo.Promotions
        (PromotionId, StallId, PromoCode, PromoTitle, [Desc], PromoType,
         DiscountValue, MinSpend, MaxDiscount, RedemptionsLeft,
         ClaimOnce, IsPopular, ExpiresAt, RequiredKeyword, ImageUrl, CreatedAt)
      VALUES
        (@promotionId, @stallId, @promoCode, @promoTitle, @desc, @promoType,
         @discountValue, @minSpend, @maxDiscount, @redemptionsLeft,
         @claimOnce, @isPopular, @expiresAt, @requiredKeyword, @imageUrl,
         SYSUTCDATETIME());
    `);

  return promotionId;
}

// UPDATE: edit a promotion. Scoped to the owning stall.
// Returns rows affected (0 = not found / not owned).
async function updatePromotion(promotionId, stallId, p) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("promotionId", sql.NVarChar, promotionId)
    .input("stallId", sql.NVarChar, stallId)
    .input("promoCode", sql.NVarChar, p.promoCode)
    .input("promoTitle", sql.NVarChar, p.promoTitle)
    .input("desc", sql.NVarChar, p.desc || null)
    .input("promoType", sql.NVarChar, p.promoType)
    .input("discountValue", sql.Decimal(10, 2), p.discountValue)
    .input("minSpend", sql.Decimal(10, 2), p.minSpend)
    .input("maxDiscount", sql.Decimal(10, 2), p.maxDiscount ?? null)
    .input("redemptionsLeft", sql.Int, p.redemptionsLeft)
    .input("claimOnce", sql.Bit, p.claimOnce ? 1 : 0)
    .input("isPopular", sql.Bit, p.isPopular ? 1 : 0)
    .input("expiresAt", sql.DateTime2, p.expiresAt || null)
    .input("requiredKeyword", sql.NVarChar, p.requiredKeyword || null)
    .input("imageUrl", sql.NVarChar(sql.MAX), p.imageUrl || null).query(`
      UPDATE dbo.Promotions
      SET PromoCode = @promoCode,
          PromoTitle = @promoTitle,
          [Desc] = @desc,
          PromoType = @promoType,
          DiscountValue = @discountValue,
          MinSpend = @minSpend,
          MaxDiscount = @maxDiscount,
          RedemptionsLeft = @redemptionsLeft,
          ClaimOnce = @claimOnce,
          IsPopular = @isPopular,
          ExpiresAt = @expiresAt,
          RequiredKeyword = @requiredKeyword,
          ImageUrl = @imageUrl
      WHERE PromotionId = @promotionId AND StallId = @stallId;
    `);
  return result.rowsAffected[0];
}

// DELETE: remove a promotion. Scoped to the owning stall.
async function deletePromotion(promotionId, stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("promotionId", sql.NVarChar, promotionId)
    .input("stallId", sql.NVarChar, stallId).query(`
      DELETE FROM dbo.Promotions
      WHERE PromotionId = @promotionId AND StallId = @stallId;
    `);
  return result.rowsAffected[0];
}

module.exports = {
  // customer
  getAllPromotions,
  redeemPromotion,
  getPromotionsByUserId,
  getPromotionCountByUserId,
  // stallholder
  getPromotionsByStall,
  getPromotionByIdForStall,
  addPromotion,
  updatePromotion,
  deletePromotion,
};