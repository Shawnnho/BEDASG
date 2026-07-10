const express = require('express');
const router = express.Router();
const promoController = require('../controllers/promotionController');

router.get('/', promoController.getPromotions);

module.exports = router;