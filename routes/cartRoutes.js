const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { verifyToken } = require('../middlewares/auth');

// A cart belongs to one logged-in user; :uid must match the caller's own id
// (enforced in the controller) so one account can't read/edit another's cart.
router.use(verifyToken);

router.get('/:uid', cartController.getCart);
router.post('/:uid', cartController.updateCart);

router.post('/:uid/items', cartController.addItem);
router.put('/:uid/items/:cartItemId', cartController.updateItemQty);
router.delete('/:uid/items/:cartItemId', cartController.deleteItem);

module.exports = router;