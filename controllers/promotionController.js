const Joi = require("joi");
const promoModel = require("../models/promotionModel");
const orderModel = require("../models/orderModel"); // reuse getUserInfo

// ============================================================
// CUSTOMER-FACING (existing — behaviour unchanged)
// ============================================================

const getPromotions = async (req, res) => {
  try {
    const promos = await promoModel.getAllPromotions();
    res.status(200).json(promos);
  } catch (error) {
    console.error("getPromotions error:", error.message);
    res.status(500).json({ error: "Failed to fetch promotions" });
  }
};

const redeemPromotion = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "You must be logged in to redeem a promo code" });
    }

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Promo code is required" });
    }

    const result = await promoModel.redeemPromotion(code, userId);

    if (result.success) {
      return res.status(200).json({ message: "Promotion redeemed successfully" });
    }

    if (result.reason === 'already_claimed') {
      return res.status(409).json({ error: "You've already claimed this promo code" });
    }
    if (result.reason === 'exhausted') {
      return res.status(400).json({ error: "This promo code has no redemptions left" });
    }
    if (result.reason === 'expired') {
      return res.status(400).json({ error: "This promo code has expired" });
    }
    return res.status(400).json({ error: "Invalid promo code" });
  } catch (error) {
    console.error("redeemPromotion error:", error);
    res.status(500).json({ error: "Failed to redeem promotion" });
  }
};

async function getPromotionsByUserId(req, res) {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
 
    const rows = await promoModel.getPromotionsByUserId(userId);
    const promotions = rows.map((r) => ({
      id: r.PromoId,
      code: r.PromoCode,
      expiresAt: r.ExpiresAt || null,
    }));
 
    res.json(promotions);
  } catch (error) {
    console.error("Error fetching promotions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function getPromotionCountByUserId(req,res) {
    try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
 
    const count = await promoModel.getPromotionCountByUserId(userId);
    res.json({ count });
  } catch (error) {
    console.error("Error fetching promotions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ============================================================
// STALLHOLDER-FACING (new — manage this stall's own promotions)
// ============================================================

// Resolve the logged-in owner's stall from the JWT cookie.
// Mirrors the resolveStall helper used across the stall dashboard.
async function resolveStall(req, res) {
  const userId = req.user?.UserId || req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const user = await orderModel.getUserInfo(userId);
  if (!user?.StallId) {
    res.status(404).json({ error: "No stall linked to this user" });
    return null;
  }
  return user; // { StallId, Name }
}

// Validation for create/update.
const promoSchema = Joi.object({
  promoTitle: Joi.string().trim().min(2).max(255).required().messages({
    "any.required": "A promotion title is required.",
    "string.min": "Title must be at least 2 characters.",
  }),
  promoCode: Joi.string().trim().min(2).max(50).required().messages({
    "any.required": "A promo code is required.",
    "string.min": "Promo code must be at least 2 characters.",
  }),
  desc: Joi.string().trim().max(1000).allow("", null),
  promoType: Joi.string().valid("percentage", "fixed").required().messages({
    "any.only": "Promo type must be 'percentage' or 'fixed'.",
    "any.required": "Please choose a promo type.",
  }),
  discountValue: Joi.number().positive().required().messages({
    "number.base": "Discount value must be a number.",
    "number.positive": "Discount value must be greater than 0.",
    "any.required": "A discount value is required.",
  }),
  minSpend: Joi.number().min(0).required().messages({
    "number.base": "Minimum spend must be a number.",
    "number.min": "Minimum spend cannot be negative.",
    "any.required": "A minimum spend is required (use 0 for none).",
  }),
  maxDiscount: Joi.number().positive().allow(null).messages({
    "number.positive": "Max discount must be greater than 0.",
  }),
  redemptionsLeft: Joi.number().integer().min(0).required().messages({
    "number.base": "Redemptions must be a whole number.",
    "number.min": "Redemptions cannot be negative.",
    "any.required": "Please set how many redemptions are available.",
  }),
  expiresAt: Joi.date().iso().allow("", null).messages({
    "date.format": "Expiry date must be a valid date.",
  }),
  claimOnce: Joi.boolean().default(false),
  isPopular: Joi.boolean().default(false),
  requiredKeyword: Joi.string().trim().max(100).allow("", null).messages({
    "string.max": "Required keyword must be 100 characters or fewer.",
  }),
  // Accepts either a path/URL or a base64 data URL (uploaded image).
  // ~2.2MB of base64 covers the 1.5MB client-side file limit with headroom.
  imageUrl: Joi.string().max(2400000).allow("", null),
});

// GET /api/promotions/mine  -> this stall's promotions
const getMyPromotions = async (req, res) => {
  try {
    const stall = await resolveStall(req, res);
    if (!stall) return;

    const promos = await promoModel.getPromotionsByStall(stall.StallId);
    res.status(200).json(promos);
  } catch (error) {
    console.error("getMyPromotions error:", error.message);
    res.status(500).json({ error: "Failed to fetch your promotions." });
  }
};

// POST /api/promotions  -> create a promotion for this stall
const createPromotion = async (req, res) => {
  try {
    const stall = await resolveStall(req, res);
    if (!stall) return;

    const { error, value } = promoSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const promotionId = await promoModel.addPromotion(stall.StallId, value);
    res.status(201).json({ message: "Promotion created.", promotionId });
  } catch (error) {
    console.error("createPromotion error:", error.message);
    res.status(500).json({ error: "Failed to create promotion." });
  }
};

// PUT /api/promotions/:id  -> update one of this stall's promotions
const updatePromotion = async (req, res) => {
  try {
    const stall = await resolveStall(req, res);
    if (!stall) return;

    const promotionId = req.params.id;
    if (!promotionId) {
      return res.status(400).json({ error: "Invalid promotion id." });
    }

    const { error, value } = promoSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const affected = await promoModel.updatePromotion(
      promotionId,
      stall.StallId,
      value,
    );
    if (affected === 0) {
      return res.status(404).json({ error: "Promotion not found." });
    }
    res.status(200).json({ message: "Promotion updated." });
  } catch (error) {
    console.error("updatePromotion error:", error.message);
    res.status(500).json({ error: "Failed to update promotion." });
  }
};

// DELETE /api/promotions/:id  -> delete one of this stall's promotions
const deletePromotion = async (req, res) => {
  try {
    const stall = await resolveStall(req, res);
    if (!stall) return;

    const promotionId = req.params.id;
    if (!promotionId) {
      return res.status(400).json({ error: "Invalid promotion id." });
    }

    const affected = await promoModel.deletePromotion(
      promotionId,
      stall.StallId,
    );
    if (affected === 0) {
      return res.status(404).json({ error: "Promotion not found." });
    }
    res.status(200).json({ message: "Promotion deleted." });
  } catch (error) {
    console.error("deletePromotion error:", error.message);
    res.status(500).json({ error: "Failed to delete promotion." });
  }
};

module.exports = {
  // customer
  getPromotions,
  redeemPromotion,
  getPromotionsByUserId,
  getPromotionCountByUserId,
  // stallholder
  getMyPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
};