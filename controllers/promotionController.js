const promoModel = require('../models/promotionModel');

const getPromotions = async (req, res) => {
    try {
        const promos = await promoModel.getAllPromotions();
        res.status(200).json(promos);
    } catch (error) {
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
        return res.status(400).json({ error: "Invalid promo code" });
    } catch (error) {
        console.error("redeemPromotion error:", error);
        res.status(500).json({ error: "Failed to redeem promotion" });
    }
};

module.exports = { 
    getPromotions,
    redeemPromotion
};