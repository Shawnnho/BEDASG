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

module.exports = { getOrdersForCustomer, getItemsForOrderIds };