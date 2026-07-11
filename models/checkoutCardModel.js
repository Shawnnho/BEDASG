const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");

function genId(prefix, len = 10) {
  return `${prefix}${crypto.randomBytes(len).toString("hex")}`;
}

async function getUserInfo(userId) {
  if (!userId || userId === "guest") return { Name: "Guest", Email: null };
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("UserId", sql.NVarChar(255), userId)
    .query("SELECT Name, Email FROM Users WHERE UserId = @UserId");
  return result.recordset[0] || { Name: "Guest", Email: null };
}

async function createCheckoutOrder(orderData) {
  const pool = await poolPromise;
  const userId = String(orderData.userId || "guest");
  const dbUserId = (userId === "guest" || !orderData.userId) ? null : userId;
  
  const items = Array.isArray(orderData.items) ? orderData.items : [];
  if (!items.length) throw new Error("Cart is empty");

  const pricing = orderData.pricing || {};
  const subtotal = Number(pricing.subtotal) || 0;
  const promoDiscount = Number(pricing.promoDiscount) || 0;
  const smallOrderFee = Number(pricing.smallOrderFee) || 0;
  const deliveryFee = Number(pricing.deliveryFee) || 0;
  const total = Number(pricing.total) || 0;
  const promoCode = orderData.promoCode || "NONE";
  const fulfillment = String(orderData.fulfillment || "pickup");
  const paymentMethod = String(orderData.paymentMethod || "cash");
  const address = orderData.address || {};

  const user = await getUserInfo(userId);

  const groups = new Map();
  for (const it of items) {
    const stallId = it.stallId || "tiong-bahru";
    if (!groups.has(stallId)) groups.set(stallId, []);
    groups.get(stallId).push(it);
  }
  const stallIds = Array.from(groups.keys());
  const singleStall = stallIds.length === 1;

  const checkoutId = genId("CO_");
  const orderIds = [];

  const transaction = pool.transaction();
  await transaction.begin();
  try {
    await transaction
      .request()
      .input("CheckoutId", sql.NVarChar(255), checkoutId)
      .input("UserId", sql.NVarChar(255), dbUserId)
      .input("Status", sql.NVarChar(50), "pending_payment")
      .input("FulfillmentType", sql.NVarChar(50), fulfillment)
      .input("FulfillmentAddress", sql.NVarChar(255), address.address || null)
      .input("FulfillmentPostal", sql.NVarChar(50), address.postal || null)
      .input("FulfillmentUnit", sql.NVarChar(50), address.unit || null)
      .input("PaymentMethod", sql.NVarChar(50), paymentMethod)
      .input("PaymentStatus", sql.NVarChar(50), "pending")
      .input("PricingDeliveryFee", sql.Decimal(18, 2), deliveryFee)
      .input("PricingPromoDiscount", sql.Decimal(18, 2), promoDiscount)
      .input("PricingSmallOrderFee", sql.Decimal(18, 2), smallOrderFee)
      .input("PricingSubtotal", sql.Decimal(18, 2), subtotal)
      .input("PricingTotal", sql.Decimal(18, 2), total)
      .input("PromoCode", sql.NVarChar(50), promoCode)
      .input("OrderIds", sql.NVarChar(sql.MAX), "[]")
      .query(`
        INSERT INTO dbo.Checkouts (
          CheckoutId, UserId, Status, FulfillmentType, FulfillmentAddress,
          FulfillmentPostal, FulfillmentUnit, PaymentMethod, PaymentStatus,
          PricingDeliveryFee, PricingPromoDiscount, PricingSmallOrderFee,
          PricingSubtotal, PricingTotal, PromoCode, OrderIds, CreatedAt
        ) VALUES (
          @CheckoutId, @UserId, @Status, @FulfillmentType, @FulfillmentAddress,
          @FulfillmentPostal, @FulfillmentUnit, @PaymentMethod, @PaymentStatus,
          @PricingDeliveryFee, @PricingPromoDiscount, @PricingSmallOrderFee,
          @PricingSubtotal, @PricingTotal, @PromoCode, @OrderIds, SYSUTCDATETIME()
        )
      `);

    for (const stallId of stallIds) {
      const stallItems = groups.get(stallId);
      const stallSubtotal = stallItems.reduce(
        (s, it) => s + (Number(it.totalPrice) || 0),
        0,
      );

      let stallName = stallId;
      try {
        const sres = await transaction
          .request()
          .input("StallId", sql.NVarChar(255), stallId)
          .query("SELECT StallName FROM Stalls WHERE StallId = @StallId");
        stallName = sres.recordset[0]?.StallName || stallId;
      } catch {
      }

      const orderId = genId("OD_");
      const orderNo = `ORD-${orderId.slice(-6).toUpperCase()}`;
      orderIds.push(orderId);

      const orderDeliveryFee = singleStall ? deliveryFee : 0;
      const orderSmallOrderFee = singleStall ? smallOrderFee : 0;
      const orderPromoDiscount = singleStall ? promoDiscount : 0;
      const orderTotal = singleStall ? total : stallSubtotal;

      await transaction
        .request()
        .input("OrderId", sql.NVarChar(255), orderId)
        .input("OrderNo", sql.NVarChar(50), orderNo)
        .input("StallId", sql.NVarChar(255), stallId)
        .input("StallName", sql.NVarChar(255), stallName)
        .input("CustomerId", sql.NVarChar(255), dbUserId)
        .input("CustomerName", sql.NVarChar(255), user.Name || "Guest")
        .input("CustomerEmail", sql.NVarChar(255), user.Email || null)
        .input("CheckoutId", sql.NVarChar(255), checkoutId)
        .input("OrderStatus", sql.NVarChar(50), "pending_payment")
        .input("FulfillmentType", sql.NVarChar(50), fulfillment)
        .input("FulfillmentAddress", sql.NVarChar(255), address.address || null)
        .input("FulfillmentPostal", sql.NVarChar(50), address.postal || null)
        .input("FulfillmentUnit", sql.NVarChar(50), address.unit || null)
        .input("PaymentMethod", sql.NVarChar(50), paymentMethod)
        .input(
          "PaymentStatus",
          sql.NVarChar(50),
          paymentMethod === "cash" ? null : "pending",
        )
        .input("DeliveryFee", sql.Decimal(18, 2), orderDeliveryFee)
        .input("SmallOrderFee", sql.Decimal(18, 2), orderSmallOrderFee)
        .input("Subtotal", sql.Decimal(18, 2), stallSubtotal)
        .input("TotalAmount", sql.Decimal(18, 2), orderTotal)
        .input("PromoCode", sql.NVarChar(50), promoCode)
        .input("PromoDiscount", sql.Decimal(18, 2), orderPromoDiscount)
        .query(`
          INSERT INTO dbo.Orders (
            OrderId, OrderNo, StallId, StallName, CustomerId, CustomerName, CustomerEmail,
            CheckoutId, OrderStatus, FulfillmentType, FulfillmentAddress, FulfillmentPostal,
            FulfillmentUnit, PaymentMethod, PaymentStatus, DeliveryFee, SmallOrderFee,
            Subtotal, TotalAmount, PromoCode, PromoDiscount, CreatedAt, UpdatedAt
          ) VALUES (
            @OrderId, @OrderNo, @StallId, @StallName, @CustomerId, @CustomerName, @CustomerEmail,
            @CheckoutId, @OrderStatus, @FulfillmentType, @FulfillmentAddress, @FulfillmentPostal,
            @FulfillmentUnit, @PaymentMethod, @PaymentStatus, @DeliveryFee, @SmallOrderFee,
            @Subtotal, @TotalAmount, @PromoCode, @PromoDiscount, SYSUTCDATETIME(), SYSUTCDATETIME()
          )
        `);

      for (const it of stallItems) {
        await transaction
          .request()
          .input("OrderId", sql.NVarChar(255), orderId)
          .input("ItemId", sql.NVarChar(255), it.itemId || null)
          .input("ItemName", sql.NVarChar(255), it.name || "Item")
          .input("ImageUrl", sql.NVarChar(500), it.img || null)
          .input("StallId", sql.NVarChar(255), stallId)
          .input("Quantity", sql.Int, Number(it.qty) || 1)
          .input("UnitPrice", sql.Decimal(18, 2), Number(it.unitPrice) || 0)
          .input("LineTotal", sql.Decimal(18, 2), Number(it.totalPrice) || 0)
          .input("VariantKey", sql.NVarChar(100), it.variantKey || null)
          .input("VariantLabel", sql.NVarChar(255), it.variantLabel || null)
          .input("ItemNote", sql.NVarChar(500), it.note || null)
          .input(
            "AddonsJson",
            sql.NVarChar(sql.MAX),
            JSON.stringify(it.addons || []),
          )
          .input(
            "RequiredModifiersJson",
            sql.NVarChar(sql.MAX),
            JSON.stringify(it.required || []),
          )
          .query(`
            INSERT INTO dbo.OrderItems (
              OrderId, ItemId, ItemName, ImageUrl, StallId, Quantity, UnitPrice, LineTotal,
              VariantKey, VariantLabel, ItemNote, AddonsJson, RequiredModifiersJson
            ) VALUES (
              @OrderId, @ItemId, @ItemName, @ImageUrl, @StallId, @Quantity, @UnitPrice, @LineTotal,
              @VariantKey, @VariantLabel, @ItemNote, @AddonsJson, @RequiredModifiersJson
            )
          `);
      }
    }

    await transaction
      .request()
      .input("CheckoutId", sql.NVarChar(255), checkoutId)
      .input("OrderIds", sql.NVarChar(sql.MAX), JSON.stringify(orderIds))
      .query(
        `UPDATE dbo.Checkouts SET OrderIds = @OrderIds WHERE CheckoutId = @CheckoutId`,
      );

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  return { checkoutId, orderIds, primaryOrderId: orderIds[0] };
}

async function getCheckoutSummary(id) {
  if (!id) return null;
  const pool = await poolPromise;

  const cRes = await pool
    .request()
    .input("Id", sql.NVarChar(255), id)
    .query("SELECT * FROM dbo.Checkouts WHERE CheckoutId = @Id");

  let checkout = cRes.recordset[0] || null;
  let orders = [];

  if (checkout) {
    const oRes = await pool
      .request()
      .input("CheckoutId", sql.NVarChar(255), id)
      .query(
        "SELECT * FROM dbo.Orders WHERE CheckoutId = @CheckoutId ORDER BY CreatedAt ASC",
      );
    orders = oRes.recordset;
  } else {
    const oRes = await pool
      .request()
      .input("OrderId", sql.NVarChar(255), id)
      .query("SELECT * FROM dbo.Orders WHERE OrderId = @OrderId");
    orders = oRes.recordset;
    if (!orders.length) return null;

    const parentCheckoutId = orders[0].CheckoutId;
    if (parentCheckoutId) {
      const pcRes = await pool
        .request()
        .input("Id", sql.NVarChar(255), parentCheckoutId)
        .query("SELECT * FROM dbo.Checkouts WHERE CheckoutId = @Id");
      checkout = pcRes.recordset[0] || null;
    }
  }

  if (!orders.length) return null;

  const orderIds = orders.map((o) => o.OrderId);
  const request = pool.request();
  const params = orderIds.map((oid, i) => {
    request.input(`o${i}`, sql.NVarChar(255), oid);
    return `@o${i}`;
  });
  const itemsRes = await request.query(`
    SELECT * FROM dbo.OrderItems WHERE OrderId IN (${params.join(",")}) ORDER BY OrderItemId ASC
  `);

  return { checkout, orders, items: itemsRes.recordset };
}

async function markPaid({ id, paymentRef }) {
  const pool = await poolPromise;

  const cRes = await pool
    .request()
    .input("Id", sql.NVarChar(255), id)
    .query("SELECT CheckoutId FROM dbo.Checkouts WHERE CheckoutId = @Id");

  const checkoutId = cRes.recordset[0]?.CheckoutId || null;

  const transaction = pool.transaction();
  await transaction.begin();
  try {
    if (checkoutId) {
      await transaction
        .request()
        .input("CheckoutId", sql.NVarChar(255), checkoutId)
        .input("PaymentRef", sql.NVarChar(255), paymentRef || null)
        .query(`
          UPDATE dbo.Checkouts
          SET Status = 'paid', PaymentStatus = 'paid', PaymentRef = @PaymentRef,
              PaymentPaidAt = SYSUTCDATETIME()
          WHERE CheckoutId = @CheckoutId
        `);

      await transaction
        .request()
        .input("CheckoutId", sql.NVarChar(255), checkoutId)
        .input("PaymentRef", sql.NVarChar(255), paymentRef || null)
        .query(`
          UPDATE dbo.Orders
          SET OrderStatus = 'processing', PaymentStatus = 'Paid', PaymentRef = @PaymentRef,
              PaidAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
          WHERE CheckoutId = @CheckoutId
        `);
    } else {
      await transaction
        .request()
        .input("OrderId", sql.NVarChar(255), id)
        .input("PaymentRef", sql.NVarChar(255), paymentRef || null)
        .query(`
          UPDATE dbo.Orders
          SET OrderStatus = 'processing', PaymentStatus = 'Paid', PaymentRef = @PaymentRef,
              PaidAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
          WHERE OrderId = @OrderId
        `);
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  return getCheckoutSummary(checkoutId || id);
}

module.exports = {
  createCheckoutOrder,
  getCheckoutSummary,
  markPaid,
};