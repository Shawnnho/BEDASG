const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const savedCardController = require('../controllers/savedCardController');

router.get('/:uid', verifyToken, savedCardController.getSavedCards);
router.post('/:uid', verifyToken, savedCardController.saveCard);
router.delete('/:uid/:savedCardId', verifyToken, savedCardController.deleteSavedCard);

module.exports = router;