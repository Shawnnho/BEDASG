const Promotion = require('../models/promotionModel');

const getAllPromotions = async (req, res) => {
    try {
        const promotions = await Promotion.getAllPromotions();
        res.status(200).json(promotions);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving promotions', error: error.message });
    }
};

module.exports = { getAllPromotions };