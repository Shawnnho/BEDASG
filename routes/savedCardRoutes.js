const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const savedCardController = require('../controllers/savedCardController');

router.get('/:uid', verifyToken, savedCardController.getSavedCards
    // #swagger.tags = ['Saved Cards (Customer)']
    // #swagger.summary = "Get the user's saved cards"
);
router.post('/:uid', verifyToken, savedCardController.saveCard
    // #swagger.tags = ['Saved Cards (Customer)']
    // #swagger.summary = "Save a new card for the user"
);
router.patch('/:uid/:savedCardId/active', verifyToken, savedCardController.setActiveCard
    // #swagger.tags = ['Saved Cards (Customer)']
    // #swagger.summary = "Set a saved card as the active/default card"
); // New Route
router.delete('/:uid/:savedCardId', verifyToken, savedCardController.deleteSavedCard
    // #swagger.tags = ['Saved Cards (Customer)']
    // #swagger.summary = "Delete a saved card"
);

module.exports = router;