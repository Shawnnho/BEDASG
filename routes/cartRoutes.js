const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { verifyToken } = require('../middlewares/auth');

// A cart belongs to one logged-in user; :uid must match the caller's own id
// (enforced in the controller) so one account can't read/edit another's cart.
router.use(verifyToken);

router.get('/:uid', cartController.getCart
    // #swagger.tags = ['Cart (Customer)']
    // #swagger.summary = 'Get a user\'s cart'
);
router.post('/:uid', cartController.updateCart
    // #swagger.tags = ['Cart (Customer)']
    // #swagger.summary = 'Update a user\'s cart'
);

router.post('/:uid/items', cartController.addItem
    // #swagger.tags = ['Cart (Customer)']
    // #swagger.summary = 'Add an item to a user\'s cart'
);
router.put('/:uid/items/:cartItemId', cartController.updateItemQty
    // #swagger.tags = ['Cart (Customer)']
    // #swagger.summary = 'Update the quantity of an item in a user\'s cart'
);
router.delete('/:uid/items/:cartItemId', cartController.deleteItem
    // #swagger.tags = ['Cart (Customer)']
    // #swagger.summary = 'Remove an item from a user\'s cart'
);

module.exports = router;