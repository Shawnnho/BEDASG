const checkoutCardModel = require('../models/checkoutCardModel');

const createCheckout = async (req, res) => {
    try {
        const orderId = await checkoutCardModel.createCheckoutOrder(req.body);
        res.status(201).json({ success: true, orderId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create order" });
    }
};

const getCheckout = async (req, res) => {
    try {
        const orderId = req.params.checkoutId;
        const order = await checkoutCardModel.getCheckoutById(orderId);
        
        if (!order) {
            return res.status(404).json({ error: "Checkout not found" });
        }
        
        res.status(200).json({
            id: order.OrderId,
            total: order.Total,
            userId: order.UserId,
            status: order.Status
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch checkout" });
    }
};

const payCheckout = async (req, res) => {
    try {
        const orderId = req.params.checkoutId;
        await checkoutCardModel.markCheckoutPaid(orderId);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to process payment" });
    }
};

module.exports = {
    createCheckout,
    getCheckout,
    payCheckout
};