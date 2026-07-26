const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");

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

async function redeemPromotion(promoCode) {
  const pool = await poolPromise;
  const result = await pool.request().input("promoCode", sql.VarChar, promoCode)
    .query(`
            UPDATE dbo.Promotions
            SET RedemptionsLeft = RedemptionsLeft - 1
            WHERE PromoCode = @promoCode AND RedemptionsLeft > 0
        `);
  return result.rowsAffected[0] > 0;
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

// CREATE: add a promotion for this stall. Returns the new PromotionId.
// StallId and PromotionId are set here, never trusted from the client.
async function addPromotion(stallId, p) {
  const pool = await poolPromise;
  const promotionId = crypto.randomUUID();

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
  // stallholder
  getPromotionsByStall,
  getPromotionByIdForStall,
  addPromotion,
  updatePromotion,
  deletePromotion,
};
