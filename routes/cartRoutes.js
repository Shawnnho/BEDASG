const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

router.get('/:uid', cartController.getCart);
router.post('/:uid', cartController.updateCart);

module.exports = router;