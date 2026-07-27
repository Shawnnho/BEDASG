const express = require('express');
const router = express.Router();
const checkoutCardController = require('../controllers/checkoutCardController');
const { optionalAuth } = require('../middlewares/auth');

// Guest checkout is a supported flow, so these can't require login — but
// when the caller IS logged in, the controller checks the checkout's owner
// against req.user so one account can't view/pay another's order.
router.use(optionalAuth);

router.post('/create', checkoutCardController.createCheckout);
router.get('/:checkoutId', checkoutCardController.getCheckout);
router.get('/:checkoutId/qr', checkoutCardController.getCheckoutQr);
router.post('/:checkoutId/pay', checkoutCardController.payCheckout);

module.exports = router;