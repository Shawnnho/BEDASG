const checkoutCardModel = require("../models/checkoutCardModel");
const CartModel = require("../models/cartModel");

// Guest checkouts (checkout.UserId is null) are viewable/payable by anyone
// holding the unguessable checkoutId — that's the intended guest-checkout
// flow. But if the checkout DOES belong to a registered user, block anyone
// else (including a different logged-in user) from viewing/paying it.
function ownsCheckoutOrForbid(req, res, checkout) {
  if (checkout?.UserId && checkout.UserId !== req.user?.userId) {
    res.status(403).json({ error: "You don't have access to this checkout." });
    return false;
  }
  return true;
}

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
    if (!ownsCheckoutOrForbid(req, res, summary.checkout)) return;
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

    const existing = await checkoutCardModel.getCheckoutSummary(id);
    if (!existing) {
      return res.status(404).json({ error: "Checkout not found" });
    }
    if (!ownsCheckoutOrForbid(req, res, existing.checkout)) return;

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