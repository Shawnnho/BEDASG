const { sql, poolPromise } = require("../dbConfig");

async function getOrdersForCustomer(userId, checkoutIdFilter) {
  const pool = await poolPromise;
  const request = pool.request().input("UserId", sql.NVarChar(255), userId);

  let where = "WHERE CustomerId = @UserId";
  if (checkoutIdFilter) {
    request.input("CheckoutId", sql.NVarChar(255), checkoutIdFilter);
    where += " AND CheckoutId = @CheckoutId";
  }

  const result = await request.query(`
    SELECT * FROM dbo.Orders
    ${where}
    ORDER BY CreatedAt DESC
  `);
  return result.recordset;
}

async function getItemsForOrderIds(orderIds) {
  if (!orderIds.length) return [];
  const pool = await poolPromise;
  const request = pool.request();

  const params = orderIds.map((id, i) => {
    request.input(`o${i}`, sql.NVarChar(255), id);
    return `@o${i}`;
  });

  const result = await request.query(`
    SELECT * FROM dbo.OrderItems
    WHERE OrderId IN (${params.join(",")})
    ORDER BY OrderItemId ASC
  `);
  return result.recordset;
}

async function deleteOrdersForCustomer(userId, id) {
  const pool = await poolPromise;

  // Is `id` a CheckoutId belonging to this user?
  const cRes = await pool
    .request()
    .input("Id", sql.NVarChar(255), id)
    .input("UserId", sql.NVarChar(255), userId)
    .query(
      "SELECT CheckoutId FROM dbo.Checkouts WHERE CheckoutId = @Id AND UserId = @UserId",
    );
  const checkoutId = cRes.recordset[0]?.CheckoutId || null;

  const request = pool.request().input("UserId", sql.NVarChar(255), userId);

  // Find every OrderId to delete: either every order under this checkout,
  // or just the single bare order if no matching checkout was found.
  let orderIdsRes;
  if (checkoutId) {
    orderIdsRes = await request
      .input("CheckoutId", sql.NVarChar(255), checkoutId)
      .query(
        "SELECT OrderId FROM dbo.Orders WHERE CheckoutId = @CheckoutId AND CustomerId = @UserId",
      );
  } else {
    orderIdsRes = await request
      .input("OrderId", sql.NVarChar(255), id)
      .query(
        "SELECT OrderId FROM dbo.Orders WHERE OrderId = @OrderId AND CustomerId = @UserId",
      );
  }

  const orderIds = orderIdsRes.recordset.map((r) => r.OrderId);
  if (!orderIds.length) return 0;

  const transaction = pool.transaction();
  await transaction.begin();
  try {
    const itemsReq = transaction.request();
    const params = orderIds.map((oid, i) => {
      itemsReq.input(`o${i}`, sql.NVarChar(255), oid);
      return `@o${i}`;
    });

    await itemsReq.query(
      `DELETE FROM dbo.OrderItems WHERE OrderId IN (${params.join(",")})`,
    );

    const ordersReq = transaction.request();
    const params2 = orderIds.map((oid, i) => {
      ordersReq.input(`o${i}`, sql.NVarChar(255), oid);
      return `@o${i}`;
    });
    await ordersReq.query(
      `DELETE FROM dbo.Orders WHERE OrderId IN (${params2.join(",")})`,
    );

    if (checkoutId) {
      await transaction
        .request()
        .input("CheckoutId", sql.NVarChar(255), checkoutId)
        .input("UserId", sql.NVarChar(255), userId)
        .query(
          "DELETE FROM dbo.Checkouts WHERE CheckoutId = @CheckoutId AND UserId = @UserId",
        );
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  return orderIds.length;
}

async function cancelOrder(userId, id) {
  const pool = await poolPromise;

  // Is `id` a CheckoutId belonging to this user?
  const cRes = await pool
    .request()
    .input("Id", sql.NVarChar(255), id)
    .input("UserId", sql.NVarChar(255), userId)
    .query(
      "SELECT CheckoutId FROM dbo.Checkouts WHERE CheckoutId = @Id AND UserId = @UserId",
    );
  const checkoutId = cRes.recordset[0]?.CheckoutId || null;

  const request = pool.request().input("UserId", sql.NVarChar(255), userId);

  const query = checkoutId
    ? request.input("CheckoutId", sql.NVarChar(255), checkoutId).query(`
        UPDATE dbo.Orders
        SET OrderStatus = 'cancelled',
            CancelReason = 'customer_cancelled',
            CancelledAt = SYSUTCDATETIME(),
            UpdatedAt = SYSUTCDATETIME()
        WHERE CheckoutId = @CheckoutId
          AND CustomerId = @UserId
          AND OrderStatus NOT IN ('completed', 'cancelled')
      `)
    : request.input("OrderId", sql.NVarChar(255), id).query(`
        UPDATE dbo.Orders
        SET OrderStatus = 'cancelled',
            CancelReason = 'customer_cancelled',
            CancelledAt = SYSUTCDATETIME(),
            UpdatedAt = SYSUTCDATETIME()
        WHERE OrderId = @OrderId
          AND CustomerId = @UserId
          AND OrderStatus NOT IN ('completed', 'cancelled')
      `);

  const result = await query;

  if (checkoutId && result.rowsAffected[0] > 0) {
    await pool
      .request()
      .input("CheckoutId", sql.NVarChar(255), checkoutId)
      .query(
        "UPDATE dbo.Checkouts SET Status = 'cancelled' WHERE CheckoutId = @CheckoutId",
      );
  }

  return result.rowsAffected[0];
}

module.exports = { getOrdersForCustomer, getItemsForOrderIds, deleteOrdersForCustomer, cancelOrder };