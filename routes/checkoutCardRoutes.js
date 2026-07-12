const express = require('express');
const router = express.Router();
const checkoutCardController = require('../controllers/checkoutCardController');

router.post('/create', checkoutCardController.createCheckout);
router.get('/:checkoutId', checkoutCardController.getCheckout);
router.post('/:checkoutId/pay', checkoutCardController.payCheckout);

module.exports = router;