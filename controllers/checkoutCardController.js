const checkoutCardModel = require("../models/checkoutCardModel");
const CartModel = require("../models/cartModel");
const stallOwnerLookupModel = require("../models/stallOwnerLookupModel");
const { sendOrderConfirmation, sendNewOrderAlert } = require("../services/notificationEmails");
const QRCode = require("qrcode");

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

function formatSGDateTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// AddonsJson is stored as JSON.stringify(it.addons || []) at order creation —
// an array of { label/id, price } objects. The email template just wants
// plain label strings.
function parseAddonLabels(addonsJson) {
  if (!addonsJson) return [];
  try {
    const arr = JSON.parse(addonsJson);
    return Array.isArray(arr) ? arr.map((a) => a.label || a.id || String(a)) : [];
  } catch {
    return [];
  }
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const createCheckout = async (req, res) => {
  try {
    // userId always comes from the verified JWT (or "guest" when
    // anonymous) — never from the request body, otherwise a caller could
    // attach an order to any other account just by naming its id.
    const userId = req.user?.userId || "guest";
    const result = await checkoutCardModel.createCheckoutOrder({
      ...req.body,
      userId,
    });
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

    if (Array.isArray(summary.orders)) {
      for (const order of summary.orders) {
        const orderItems = (summary.items || [])
          .filter((it) => it.OrderId === order.OrderId)
          .map((it) => ({
            name: it.ItemName || "Item",
            img: it.ImageUrl || null,
            qty: Number(it.Quantity) || 1,
            addons: parseAddonLabels(it.AddonsJson),
            note: it.ItemNote || "",
          }));

        const emailOrder = {
          orderId: order.OrderNo || order.OrderId,
          paidAt: formatSGDateTime(order.PaidAt),
          stallName: order.StallName,
          paymentMethod: capitalize(order.PaymentMethod) || "Card",
          totalPaid: Number(order.TotalAmount ?? 0),
          items: orderItems,
        };

        if (order.CustomerEmail) {
          sendOrderConfirmation(order.CustomerEmail, emailOrder).catch((err) =>
            console.error("Order confirmation email failed:", err.message),
          );
        }

        if (order.StallId) {
          stallOwnerLookupModel
            .getStallOwnerEmail(order.StallId)
            .then((ownerEmail) => {
              if (ownerEmail) sendNewOrderAlert(ownerEmail, emailOrder);
            })
            .catch((err) => console.error("New order alert email failed:", err.message));
        }
      }
    }

    res.status(200).json({ success: true, ...summary });
  } catch (error) {
    console.error("payCheckout error:", error);
    res.status(500).json({ error: "Failed to process payment" });
  }
};

// Same lookup + ownership rules as getCheckout — this just streams a PNG
// instead of JSON. Encodes the order number (same value shown in prOrderId
// on the front end) so stall staff can scan it against the order.
const getCheckoutQr = async (req, res) => {
  try {
    const id = req.params.checkoutId;
    const summary = await checkoutCardModel.getCheckoutSummary(id);
    if (!summary || !summary.orders?.length) {
      return res.status(404).json({ error: "Checkout not found" });
    }
    if (!ownsCheckoutOrForbid(req, res, summary.checkout)) return;

    const orderNo = summary.orders[0].OrderNo || summary.orders[0].OrderId;

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");

    await QRCode.toFileStream(res, String(orderNo), {
      type: "png",
      width: 300,
      margin: 1,
    });
  } catch (error) {
    console.error("getCheckoutQr error:", error);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
};

module.exports = {
  createCheckout,
  getCheckout,
  payCheckout,
  getCheckoutQr,
};