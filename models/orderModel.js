const { poolPromise, sql } = require("../dbConfig");

// Look up the StallId that belongs to a given user (stall owner)
async function getStallIdByUser(userId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("UserId", sql.NVarChar(255), userId)
    .query("SELECT StallId FROM Users WHERE UserId = @UserId");
  return result.recordset[0]?.StallId || null;
}

// Get the user's StallId + display name in one query
async function getUserInfo(userId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("UserId", sql.NVarChar(255), userId)
    .query("SELECT StallId, Name FROM Users WHERE UserId = @UserId");
  return result.recordset[0] || null;
}

// Get the stall's display name
async function getStallName(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("StallId", sql.NVarChar(255), stallId)
    .query("SELECT StallName FROM Stalls WHERE StallId = @StallId");
  return result.recordset[0]?.StallName || null;
}

// Get recent orders for a stall, with a one-line item summary per order
async function getOrdersByStall(stallId, limitN = 50) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("StallId", sql.NVarChar(255), stallId)
    .input("LimitN", sql.Int, limitN).query(`
      SELECT TOP (@LimitN)
        o.OrderId,
        o.OrderNo,
        o.CustomerId,
        o.CustomerName,
        o.CustomerEmail,
        o.OrderStatus,
        o.PaymentMethod,
        o.TotalAmount,
        o.Subtotal,
        o.CreatedAt,
        o.UpdatedAt,
        (
          SELECT TOP (1) oi.ItemName
          FROM OrderItems oi
          WHERE oi.OrderId = o.OrderId
          ORDER BY oi.OrderItemId ASC
        ) AS FirstItemName,
        (
          SELECT TOP (1) oi.Quantity
          FROM OrderItems oi
          WHERE oi.OrderId = o.OrderId
          ORDER BY oi.OrderItemId ASC
        ) AS FirstItemQty,
        (
          SELECT COUNT(*)
          FROM OrderItems oi
          WHERE oi.OrderId = o.OrderId
        ) AS ItemCount
      FROM Orders o
      WHERE o.StallId = @StallId
      ORDER BY o.CreatedAt DESC;
    `);
  return result.recordset;
}

// Update the status of one order (scoped to the stall so an owner can't touch others' orders)
async function updateOrderStatus(orderId, stallId, newStatus) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("OrderId", sql.NVarChar(255), orderId)
    .input("StallId", sql.NVarChar(255), stallId)
    .input("NewStatus", sql.NVarChar(50), newStatus).query(`
      UPDATE Orders
      SET OrderStatus = @NewStatus,
          UpdatedAt = SYSUTCDATETIME()
      WHERE OrderId = @OrderId AND StallId = @StallId;
    `);
  return result.rowsAffected[0]; // 0 = not found / not owned, 1 = updated
}

// Cash-like payment methods appear as: cash, Cash. Match case-insensitively.
// Get all orders for the stall-orders page, grouped later in the controller.
async function getStallOrdersForPage(stallId, limitN = 50) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("StallId", sql.NVarChar(255), stallId)
    .input("LimitN", sql.Int, limitN).query(`
      SELECT TOP (@LimitN)
        o.OrderId,
        o.OrderNo,
        o.CustomerName,
        o.OrderStatus,
        o.PaymentMethod,
        o.PaymentStatus,
        o.PaidAt,
        o.FulfillmentType,
        o.FulfillmentAddress,
        o.FulfillmentPostal,
        o.FulfillmentUnit,
        o.Subtotal,
        o.DeliveryFee,
        o.SmallOrderFee,
        o.PromoCode,
        o.PromoDiscount,
        o.TotalAmount,
        o.CreatedAt
      FROM Orders o
      WHERE o.StallId = @StallId
        AND o.OrderStatus IN
          ('pending_payment','paid','processing','preparing','ready','completed')
      ORDER BY o.CreatedAt DESC;
    `);
  return result.recordset;
}

// Get all line items for a set of order ids (one query, grouped in JS)
async function getItemsForOrders(orderIds) {
  if (!orderIds.length) return [];
  const pool = await poolPromise;
  const request = pool.request();

  // Build a parameterised IN list: @o0, @o1, ...
  const params = orderIds.map((id, i) => {
    request.input(`o${i}`, sql.NVarChar(255), id);
    return `@o${i}`;
  });

  const result = await request.query(`
    SELECT
      OrderItemId,
      OrderId,
      ItemName,
      Quantity,
      UnitPrice,
      LineTotal,
      VariantLabel,
      ItemNote,
      AddonsJson,
      RequiredModifiersJson
    FROM OrderItems
    WHERE OrderId IN (${params.join(",")})
    ORDER BY OrderItemId ASC;
  `);
  return result.recordset;
}

// Confirm a cash order as paid (scoped to stall).
// Sets PaymentStatus so the money column agrees with the fulfilment column.
async function confirmCashReceived(orderId, stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("OrderId", sql.NVarChar(255), orderId)
    .input("StallId", sql.NVarChar(255), stallId).query(`
      UPDATE Orders
      SET OrderStatus   = 'processing',
          PaymentStatus = 'paid',
          PaidAt        = SYSUTCDATETIME(),
          UpdatedAt     = SYSUTCDATETIME()
      WHERE OrderId = @OrderId
        AND StallId = @StallId
        AND OrderStatus = 'pending_payment';
    `);
  return result.rowsAffected[0]; // 1 = confirmed, 0 = not found / already paid
}

// Read an order's current state so the controller can decide if a refund is owed
async function getOrderForCancel(orderId, stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("OrderId", sql.NVarChar(255), orderId)
    .input("StallId", sql.NVarChar(255), stallId).query(`
      SELECT OrderId, OrderStatus, PaymentStatus, PaymentMethod, TotalAmount
      FROM Orders
      WHERE OrderId = @OrderId AND StallId = @StallId;
    `);
  return result.recordset[0] || null;
}

// Cancel an order.
// If the customer already paid, flag a refund as pending so the owner can settle it.
// Completed orders can't be cancelled — the food is already gone.
async function cancelOrder(orderId, stallId, reason, needsRefund) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("OrderId", sql.NVarChar(255), orderId)
    .input("StallId", sql.NVarChar(255), stallId)
    .input("Reason", sql.NVarChar(255), reason)
    .input("RefundStatus", sql.NVarChar(20), needsRefund ? "pending" : null)
    .query(`
      UPDATE Orders
      SET OrderStatus  = 'cancelled',
          CancelReason = @Reason,
          CancelledAt  = SYSUTCDATETIME(),
          RefundStatus = @RefundStatus,
          UpdatedAt    = SYSUTCDATETIME()
      WHERE OrderId = @OrderId
        AND StallId = @StallId
        AND OrderStatus IN ('pending_payment', 'processing');
    `);
  return result.rowsAffected[0]; // 0 = not found / already completed or cancelled
}

// Mark a pending refund as settled (owner has physically refunded the customer)
async function markRefunded(orderId, stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("OrderId", sql.NVarChar(255), orderId)
    .input("StallId", sql.NVarChar(255), stallId).query(`
      UPDATE Orders
      SET RefundStatus = 'refunded',
          RefundedAt   = SYSUTCDATETIME(),
          UpdatedAt    = SYSUTCDATETIME()
      WHERE OrderId = @OrderId
        AND StallId = @StallId
        AND RefundStatus = 'pending';
    `);
  return result.rowsAffected[0];
}

module.exports = {
  getStallIdByUser,
  getUserInfo,
  getStallName,
  getOrdersByStall,
  updateOrderStatus,
  getStallOrdersForPage,
  getItemsForOrders,
  getOrderForCancel,
  cancelOrder,
  markRefunded,
  confirmCashReceived,
};
