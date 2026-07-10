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

    res.json({
      stallName: stallName || "—",
      ownerName: user.Name || "Owner",
      orders,
      stats: { pending, inProgress, cancelled, sales },
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

module.exports = { getDashboard, bulkUpdateStatus };
