const CartModel = require('../models/cartModel');

// A cart is only ever the caller's own — this blocks one account from
// reading/editing another user's cart via a guessed/observed :uid.
function ownCartOrForbid(req, res) {
    if (req.params.uid !== req.user.userId) {
        res.status(403).json({ message: 'You can only access your own cart' });
        return false;
    }
    return true;
}

const getCart = async (req, res) => {
    if (!ownCartOrForbid(req, res)) return;
    try {
        const items = await CartModel.getCartItems(req.params.uid);
        res.status(200).json(items);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching cart', error: error.message });
    }
};

const updateCart = async (req, res) => {
    if (!ownCartOrForbid(req, res)) return;
    try {
        await CartModel.updateCartItems(req.params.uid, req.body.items);
        res.status(200).json({ message: 'Cart updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating cart', error: error.message });
    }
};

// POST /api/cart/:uid/items — CREATE a single item
const addItem = async (req, res) => {
    if (!ownCartOrForbid(req, res)) return;
    try {
        const cartItemId = await CartModel.addCartItem(req.params.uid, req.body);
        res.status(201).json({ success: true, cartItemId });
    } catch (error) {
        res.status(500).json({ message: 'Error adding item', error: error.message });
    }
};

// PUT /api/cart/:uid/items/:cartItemId — UPDATE the quantity of a single item
const updateItemQty = async (req, res) => {
    if (!ownCartOrForbid(req, res)) return;
    try {
        const affected = await CartModel.updateCartItemQty(
            req.params.uid,
            req.params.cartItemId,
            req.body.qty,
        );
        if (!affected) {
            return res.status(404).json({ message: 'Item not found in your cart' });
        }
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Error updating item', error: error.message });
    }
};

// DELETE /api/cart/:uid/items/:cartItemId — DELETE a single item
const deleteItem = async (req, res) => {
    if (!ownCartOrForbid(req, res)) return;
    try {
        const affected = await CartModel.deleteCartItem(req.params.uid, req.params.cartItemId);
        if (!affected) {
            return res.status(404).json({ message: 'Item not found in your cart' });
        }
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting item', error: error.message });
    }
};

module.exports = { getCart, updateCart, addItem, updateItemQty, deleteItem };