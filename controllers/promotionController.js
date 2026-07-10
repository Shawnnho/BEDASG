const promoModel = require('../models/promotionModel');

const getPromotions = async (req, res) => {
    try {
        const promos = await promoModel.getAllPromotions();
        res.status(200).json(promos);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch promotions" });
    }
};

module.exports = { 
    getPromotions 
};