const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

router.get('/:uid', cartController.getCart);
router.post('/:uid', cartController.updateCart);

router.post('/:uid/items', cartController.addItem);
router.put('/:uid/items/:cartItemId', cartController.updateItemQty);
router.delete('/:uid/items/:cartItemId', cartController.deleteItem);

module.exports = router;