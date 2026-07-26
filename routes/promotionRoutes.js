const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const promoController = require('../controllers/promotionController');

router.get('/', promoController.getPromotions);
router.post('/redeem', verifyToken, promoController.redeemPromotion);

module.exports = router;