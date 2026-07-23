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
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: "Promo code is required" });
        }
        
        const success = await promoModel.redeemPromotion(code);
        if (success) {
            res.status(200).json({ message: "Promotion redeemed successfully" });
        } else {
            res.status(400).json({ error: "Invalid promo code or redemption limit reached" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to redeem promotion" });
    }
};

module.exports = { 
    getPromotions,
    redeemPromotion
};