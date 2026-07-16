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

module.exports = { getMyOrders };