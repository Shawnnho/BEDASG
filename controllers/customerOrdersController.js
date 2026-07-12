const customerOrdersModel = require("../models/customerOrdersModel");

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
        name: it.ItemName,
        qty: Number(it.Quantity ?? 1),
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

module.exports = { getMyOrders };