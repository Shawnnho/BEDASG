const orderModel = require("../models/orderModel");

// raw OrderStatus (DB) -> dashboard tab value
function normStatus(raw) {
  const v = String(raw || "").toLowerCase();
  if (v === "pending_payment") return "pending";
  if (v === "paid" || v === "processing") return "in-progress";
  if (v === "completed") return "completed";
  if (v === "cancelled") return "cancelled";
  return v;
}

// dashboard tab value -> raw OrderStatus (DB) for writes
function toRawStatus(tab) {
  const v = String(tab || "").toLowerCase();
  if (v === "pending") return "pending_payment";
  if (v === "in-progress") return "processing";
  if (v === "completed") return "completed";
  if (v === "cancelled") return "cancelled";
  return null; // reject anything else
}

// Build the "1x Chicken Rice + 2 more" style summary
function buildItemSummary(row) {
  const qty = Number(row.FirstItemQty) || 1;
  const name = row.FirstItemName || "Item";
  const count = Number(row.ItemCount) || 0;
  if (count <= 1) return `${qty}x ${name}`;
  return `${qty}x ${name} + ${count - 1} more`;
}

// Safe JSON.parse for the *Json columns
function safeParseArray(str) {
  if (!str) return [];
  try {
    const v = JSON.parse(str);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Normalize the messy payment method spellings into cash / qr / card / other
function normPayMethod(m) {
  const x = String(m || "").toLowerCase();
  if (x.includes("cash")) return "cash";
  if (x.includes("paynow") || x.includes("nets") || x === "qr") return "qr";
  if (x.includes("card") || x.includes("credit") || x.includes("debit"))
    return "card";
  return "other";
}

function prettyPayMethod(m) {
  const key = normPayMethod(m);
  if (key === "cash") return "Cash";
  if (key === "qr") return "PayNow / NETS QR";
  if (key === "card") return "Card";
  return m || "—";
}

// Shape one order row + its items into the object the frontend renders
function shapeOrder(row, items) {
  return {
    orderId: row.OrderId,
    orderNo: row.OrderNo,
    customerName: row.CustomerName,
    status: row.OrderStatus,
    paymentMethod: prettyPayMethod(row.PaymentMethod),
    paymentMethodKey: normPayMethod(row.PaymentMethod),
    paidAt: row.PaidAt,
    fulfillmentType: row.FulfillmentType || "pickup",
    fulfillmentAddress: row.FulfillmentAddress || "",
    fulfillmentPostal: row.FulfillmentPostal || "",
    fulfillmentUnit: row.FulfillmentUnit || "",
    pricing: {
      subtotal: Number(row.Subtotal ?? 0),
      deliveryFee: Number(row.DeliveryFee ?? 0),
      smallOrderFee: Number(row.SmallOrderFee ?? 0),
      total: Number(row.TotalAmount ?? 0),
    },
    promo: {
      code: row.PromoCode || "NONE",
      discount: Number(row.PromoDiscount ?? 0),
    },
    createdAt: row.CreatedAt,
    items: items.map((it) => ({
      name: it.ItemName || "Item",
      qty: Number(it.Quantity ?? 1),
      unitPrice: Number(it.UnitPrice ?? 0),
      lineTotal: Number(it.LineTotal ?? 0),
      variantLabel: it.VariantLabel || "",
      note: it.ItemNote || "",
      addons: safeParseArray(it.AddonsJson).map((a) => ({
        label: a.label || a.id || "",
        price: Number(a.price ?? 0),
      })),
      required: safeParseArray(it.RequiredModifiersJson).map((r) => ({
        groupTitle: r.groupTitle || "",
        optionLabel: r.optionLabel || "",
      })),
    })),
  };
}

// GET /api/stall/orders  -> unpaid cash / paid / completed, each with full items
async function getStallOrders(req, res) {
  try {
    const userId = req.user?.UserId || req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const user = await orderModel.getUserInfo(userId);
    if (!user?.StallId) {
      return res.status(404).json({ error: "No stall linked to this user" });
    }
    const stallId = user.StallId;
    const stallName = await orderModel.getStallName(stallId);

    const rows = await orderModel.getStallOrdersForPage(stallId, 50);
    const items = await orderModel.getItemsForOrders(
      rows.map((r) => r.OrderId),
    );

    // group items by OrderId
    const itemsByOrder = new Map();
    for (const it of items) {
      if (!itemsByOrder.has(it.OrderId)) itemsByOrder.set(it.OrderId, []);
      itemsByOrder.get(it.OrderId).push(it);
    }

    const shaped = rows.map((r) =>
      shapeOrder(r, itemsByOrder.get(r.OrderId) || []),
    );

    // Split into the three sections the page shows
    const unpaidCash = shaped.filter(
      (o) => o.paymentMethodKey === "cash" && o.status === "pending_payment",
    );
    const paid = shaped.filter((o) =>
      ["paid", "processing", "preparing", "ready"].includes(o.status),
    );
    const completed = shaped.filter((o) => o.status === "completed");

    res.json({
      stallName: stallName || "—",
      ownerName: user.Name || "Owner",
      unpaidCash,
      paid,
      completed,
    });
  } catch (err) {
    console.error("getStallOrders error:", err);
    res.status(500).json({ error: "Failed to load orders" });
  }
}

// PATCH /api/stall/orders/confirm-cash  { orderId }
async function confirmCash(req, res) {
  try {
    const userId = req.user?.UserId || req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const user = await orderModel.getUserInfo(userId);
    if (!user?.StallId) {
      return res.status(404).json({ error: "No stall linked to this user" });
    }

    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: "Missing orderId" });

    const affected = await orderModel.confirmCashReceived(
      orderId,
      user.StallId,
    );
    if (affected === 0) {
      return res
        .status(409)
        .json({ error: "Order not found, not yours, or already paid" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("confirmCash error:", err);
    res.status(500).json({ error: "Failed to confirm cash" });
  }
}

// GET /api/stall/dashboard  -> header info (stall name + owner) + orders + stats
async function getDashboard(req, res) {
  try {
    const userId = req.user?.UserId || req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const user = await orderModel.getUserInfo(userId);
    if (!user?.StallId) {
      return res.status(404).json({ error: "No stall linked to this user" });
    }
    const stallId = user.StallId;
    const stallName = await orderModel.getStallName(stallId);
    const rows = await orderModel.getOrdersByStall(stallId, 50);

    const orders = rows.map((r) => ({
      orderId: r.OrderId,
      orderNo: r.OrderNo,
      customerId: r.CustomerId,
      customer: r.CustomerName || r.CustomerEmail || "—",
      status: normStatus(r.OrderStatus),
      item: buildItemSummary(r),
      amount: Number(r.TotalAmount ?? r.Subtotal ?? 0),
      createdAt: r.CreatedAt,
    }));

    // Stats computed from all returned orders
    const pending = orders.filter((o) => o.status === "pending").length;
    const inProgress = orders.filter((o) => o.status === "in-progress").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    const sales = orders
      .filter((o) => o.status === "completed")
      .reduce((sum, o) => sum + o.amount, 0);

    const unpaidCash = rows.filter(
      (r) =>
        String(r.OrderStatus).toLowerCase() === "pending_payment" &&
        String(r.PaymentMethod || "")
          .toLowerCase()
          .includes("cash"),
    ).length;

    res.json({
      stallName: stallName || "—",
      ownerName: user.Name || "Owner",
      orders,
      stats: { pending, inProgress, cancelled, sales, unpaidCash },
    });
  } catch (err) {
    console.error("getDashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
}

// PATCH /api/stall/orders/status  -> bulk update { orderIds: [], status: "pending" }
async function bulkUpdateStatus(req, res) {
  try {
    const userId = req.user?.UserId || req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const stallId = await orderModel.getStallIdByUser(userId);
    if (!stallId) {
      return res.status(404).json({ error: "No stall linked to this user" });
    }

    const { orderIds, status } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: "No orders selected" });
    }

    const raw = toRawStatus(status);
    if (!raw) return res.status(400).json({ error: "Invalid status" });

    let updated = 0;
    for (const oid of orderIds) {
      updated += await orderModel.updateOrderStatus(oid, stallId, raw);
    }

    res.json({ updated });
  } catch (err) {
    console.error("bulkUpdateStatus error:", err);
    res.status(500).json({ error: "Failed to update orders" });
  }
}

// PATCH /api/stall/orders/complete  { orderId }
async function completeOrder(req, res) {
  try {
    const userId = req.user?.UserId || req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const user = await orderModel.getUserInfo(userId);
    if (!user?.StallId) {
      return res.status(404).json({ error: "No stall linked to this user" });
    }

    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: "Missing orderId" });

    const affected = await orderModel.updateOrderStatus(
      orderId,
      user.StallId,
      "completed",
    );
    if (affected === 0) {
      return res.status(409).json({ error: "Order not found or not yours" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("completeOrder error:", err);
    res.status(500).json({ error: "Failed to complete order" });
  }
}

// PATCH /api/stall/orders/cancel  { orderId }
async function cancelOrder(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const user = await orderModel.getUserInfo(userId);
    if (!user?.StallId) {
      return res.status(404).json({ error: "No stall linked to this user" });
    }

    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: "Missing orderId" });

    const affected = await orderModel.cancelOrder(orderId, user.StallId);
    if (affected === 0) {
      return res.status(409).json({
        error: "Only unpaid orders can be cancelled",
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("cancelOrder error:", err);
    res.status(500).json({ error: "Failed to cancel order" });
  }
}

module.exports = {
  getDashboard,
  bulkUpdateStatus,
  getStallOrders,
  confirmCash,
  cancelOrder,
  completeOrder,
};
