const express = require('express');
const router = express.Router();
const favouriteOrderController = require('../controllers/favouriteOrderController');
const { verifyToken } = require('../middlewares/auth');

// A favourite order belongs to one logged-in user; :uid must match the
// caller's own id (enforced in the controller).
router.use(verifyToken);

router.get('/:uid', favouriteOrderController.getFavourite);
router.put('/:uid', favouriteOrderController.saveFavourite);
router.delete('/:uid', favouriteOrderController.deleteFavourite);

module.exports = router;