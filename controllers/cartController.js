const CartModel = require('../models/cartModel');

const getCart = async (req, res) => {
    try {
        const items = await CartModel.getCartItems(req.params.uid);
        res.status(200).json(items);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching cart', error: error.message });
    }
};

const updateCart = async (req, res) => {
    try {
        await CartModel.updateCartItems(req.params.uid, req.body.items);
        res.status(200).json({ message: 'Cart updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating cart', error: error.message });
    }
};

module.exports = { getCart, updateCart };