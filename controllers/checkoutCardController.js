const checkoutCardModel = require("../models/checkoutCardModel");
const CartModel = require("../models/cartModel");

const createCheckout = async (req, res) => {
  try {
    const result = await checkoutCardModel.createCheckoutOrder(req.body);
    res.status(201).json({
      success: true,
      checkoutId: result.checkoutId,
      orderId: result.primaryOrderId,
      orderIds: result.orderIds,
    });
  } catch (error) {
    console.error("createCheckout error:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
};

const getCheckout = async (req, res) => {
  try {
    const id = req.params.checkoutId;
    const summary = await checkoutCardModel.getCheckoutSummary(id);
    if (!summary) {
      return res.status(404).json({ error: "Checkout not found" });
    }
    res.status(200).json(summary);
  } catch (error) {
    console.error("getCheckout error:", error);
    res.status(500).json({ error: "Failed to fetch checkout" });
  }
};

// This is the ONLY place a successful payment gets recorded, and the ONLY
// place the cart gets cleared for card/QR payments. Do not clear the cart
// earlier in the flow (e.g. at /create) — that was the original bug.
const payCheckout = async (req, res) => {
  try {
    const id = req.params.checkoutId;
    const paymentRef = req.body?.paymentRef || null;

    const summary = await checkoutCardModel.markPaid({ id, paymentRef });
    if (!summary) {
      return res.status(404).json({ error: "Checkout not found" });
    }

    const userId = summary.checkout?.UserId || summary.orders?.[0]?.CustomerId;
    if (userId && userId !== "guest") {
      try {
        await CartModel.updateCartItems(userId, []);
      } catch (e) {
        console.error("Cart clear after payment failed:", e);
      }
    }

    res.status(200).json({ success: true, ...summary });
  } catch (error) {
    console.error("payCheckout error:", error);
    res.status(500).json({ error: "Failed to process payment" });
  }
};

module.exports = {
  createCheckout,
  getCheckout,
  payCheckout,
};