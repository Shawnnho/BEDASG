const customerOrdersModel = require("../models/customerOrdersModel");

function safeParseArray(str) {
  if (!str) return [];
  try {
    const v = JSON.parse(str);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function shapeOrder(row, items) {
  return {
    id: row.OrderId,
    orderNo: row.OrderNo,
    stallName: row.StallName || "Unknown Stall",
    status: row.OrderStatus,
    checkoutId: row.CheckoutId || null,
    payment: { method: row.PaymentMethod },
    pricing: { total: Number(row.TotalAmount ?? 0) },
    fulfillment: { type: row.FulfillmentType || "pickup" },
    createdAt: row.CreatedAt,
    items: items
      .filter((it) => it.OrderId === row.OrderId)
      .map((it) => ({
        stallId: it.StallId,
        itemId: it.ItemId,
        name: it.ItemName,
        img: it.ImageUrl,
        qty: Number(it.Quantity ?? 1),
        unitPrice: Number(it.UnitPrice ?? 0),
        totalPrice: Number(it.LineTotal ?? 0),
        variantKey: it.VariantKey || null,
        variantLabel: it.VariantLabel || null,
        note: it.ItemNote || null,
        addons: safeParseArray(it.AddonsJson),
        required: safeParseArray(it.RequiredModifiersJson),
      })),
  };
}

const getMyOrders = async (req, res) => {
  try {
    const userId = req.user?.UserId || req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const checkoutIdFilter = req.query.checkoutId || null;

    const rows = await customerOrdersModel.getOrdersForCustomer(
      userId,
      checkoutIdFilter,
    );
    const orderIds = rows.map((r) => r.OrderId);
    const items = await customerOrdersModel.getItemsForOrderIds(orderIds);

    const orders = rows.map((r) => shapeOrder(r, items));
    res.json({ orders });
  } catch (err) {
    console.error("getMyOrders error:", err);
    res.status(500).json({ error: "Failed to load orders" });
  }
};

// Guest version of getMyOrders — identical shaping, but scoped to the guest
// session id set by the guestSession middleware instead of a logged-in user.
// If a real user hits this (req.user set), send them to the authed endpoint
// so their orders aren't silently missed.
const getGuestOrders = async (req, res) => {
  try {
    if (req.user) {
      return res
        .status(400)
        .json({
          error: "Use the authenticated orders endpoint when logged in.",
        });
    }

    const guestSessionId = req.guestSessionId || null;
    if (!guestSessionId) return res.json({ orders: [] });

    const checkoutIdFilter = req.query.checkoutId || null;

    const rows = await customerOrdersModel.getOrdersForGuest(
      guestSessionId,
      checkoutIdFilter,
    );
    const orderIds = rows.map((r) => r.OrderId);
    const items = await customerOrdersModel.getItemsForOrderIds(orderIds);

    const orders = rows.map((r) => shapeOrder(r, items));
    res.json({ orders });
  } catch (err) {
    console.error("getGuestOrders error:", err);
    res.status(500).json({ error: "Failed to load orders" });
  }
};

const deleteMyOrder = async (req, res) => {
  try {
    const userId = req.user?.UserId || req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const id = req.params.id;
    const deletedCount = await customerOrdersModel.deleteOrdersForCustomer(
      userId,
      id,
    );

    if (deletedCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ success: true, deletedCount });
  } catch (err) {
    console.error("deleteMyOrder error:", err);
    res.status(500).json({ error: "Failed to delete order" });
  }
};

const cancelMyOrder = async (req, res) => {
  try {
    const userId = req.user?.UserId || req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const id = req.params.id;
    const affected = await customerOrdersModel.cancelOrder(userId, id);

    if (affected === 0) {
      return res
        .status(409)
        .json({
          error: "Order not found, not yours, or already completed/cancelled",
        });
    }

    res.json({ success: true, cancelledCount: affected });
  } catch (err) {
    console.error("cancelMyOrder error:", err);
    res.status(500).json({ error: "Failed to cancel order" });
  }
};

module.exports = { getMyOrders, getGuestOrders, deleteMyOrder, cancelMyOrder };
