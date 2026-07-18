const express = require('express');
const router = express.Router();
const favouriteOrderController = require('../controllers/favouriteOrderController');

router.get('/:uid', favouriteOrderController.getFavourite);
router.put('/:uid', favouriteOrderController.saveFavourite);
router.delete('/:uid', favouriteOrderController.deleteFavourite);

module.exports = router;