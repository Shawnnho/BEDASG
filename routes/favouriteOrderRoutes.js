const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const favouriteOrderController = require('../controllers/favouriteOrderController');

router.get('/:uid', verifyToken, favouriteOrderController.getFavourite);
router.put('/:uid', verifyToken, favouriteOrderController.saveFavourite);
router.delete('/:uid', verifyToken, favouriteOrderController.deleteFavourite);

module.exports = router;