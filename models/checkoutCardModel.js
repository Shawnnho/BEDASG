const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");

function genId(prefix, len = 10) {
  return `${prefix}${crypto.randomBytes(len).toString("hex")}`;
}

// Split a checkout-level amount (delivery fee, small-order fee, promo
// discount) across stalls proportionally to each stall's share of the
// subtotal, so per-order totals still sum to the checkout's real total
// instead of leaving the fee unattributed to any order. The last stall
// absorbs the rounding remainder so the shares always add up exactly.
function allocateByShare(amount, stallIds, subtotalByStall, grandSubtotal) {
  const result = new Map();
  if (!amount || grandSubtotal <= 0) {
    stallIds.forEach((id) => result.set(id, 0));
    return result;
  }
  let assigned = 0;
  stallIds.forEach((id, i) => {
    if (i === stallIds.length - 1) {
      result.set(id, Math.round((amount - assigned) * 100) / 100);
    } else {
      const share =
        Math.round(((amount * subtotalByStall.get(id)) / grandSubtotal) * 100) /
        100;
      result.set(id, share);
      assigned += share;
    }
  });
  return result;
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

// Looks up the real per-unit price for a menu item from StallMenus /
// StallMenuPrices — never trust a client-supplied unitPrice/totalPrice,
// since that would let a request forge arbitrary order amounts.
async function getAuthoritativeBasePrice(pool, stallId, itemId, variantKey) {
  const menuRes = await pool
    .request()
    .input("MenuId", sql.NVarChar(255), itemId)
    .input("StallId", sql.NVarChar(255), stallId)
    .query(
      "SELECT MenuId, Name, Price FROM dbo.StallMenus WHERE MenuId = @MenuId AND StallId = @StallId",
    );
  const menu = menuRes.recordset[0];
  if (!menu) throw new Error(`Menu item not found: ${itemId}`);

  // Check for variants regardless of whether the client sent a variantKey —
  // items priced by variant can have a null/unused base StallMenus.Price,
  // so branching only on "did the client send one" would let a client get
  // a variant-priced item for free just by omitting variantKey.
  const variantsRes = await pool
    .request()
    .input("MenuId", sql.NVarChar(255), itemId)
    .query("SELECT VariantKey, Price FROM dbo.StallMenuPrices WHERE MenuId = @MenuId");
  const variants = variantsRes.recordset;

  if (variants.length > 0) {
    const variant = variants.find((v) => v.VariantKey === variantKey);
    if (!variant) throw new Error(`Invalid variant "${variantKey}" for item ${itemId}`);
    return { basePrice: Number(variant.Price) || 0, name: menu.Name };
  }

  return { basePrice: Number(menu.Price) || 0, name: menu.Name };
}

// Resolves the addons attached to a line item against StallAddons so the
// price contribution is real. Addon ids that don't belong to the stall are
// silently dropped (they can only reduce, never inflate, the charge).
async function getAuthoritativeAddons(pool, stallId, addons) {
  const list = Array.isArray(addons) ? addons : [];
  const resolved = [];
  let total = 0;
  for (const a of list) {
    const addonId = a?.id ?? a?.AddonId;
    if (!addonId) continue;
    const res = await pool
      .request()
      .input("AddonId", sql.NVarChar(255), addonId)
      .input("StallId", sql.NVarChar(255), stallId)
      .query(
        "SELECT AddonId, Label, Price FROM dbo.StallAddons WHERE AddonId = @AddonId AND StallId = @StallId AND (Active = 1 OR Active IS NULL)",
      );
    const row = res.recordset[0];
    if (!row) continue;
    const price = Number(row.Price) || 0;
    total += price;
    resolved.push({ id: row.AddonId, label: row.Label, price });
  }
  return { addons: resolved, total: Math.round(total * 100) / 100 };
}

// Mirrors the fee rules in public/js/cart.js (calcDeliveryFee / the small
// order fee inline in render()) — kept here as the source of truth so a
// client can't just send whatever smallOrderFee/deliveryFee it wants.
function computeSmallOrderFee(fulfillment, subtotal) {
  if (fulfillment !== "delivery" || subtotal >= 15) return 0;
  return Math.round(Math.min(15 - subtotal, 4) * 100) / 100;
}
function computeDeliveryFee(fulfillment) {
  return fulfillment === "delivery" ? 2.5 : 0;
}

// Recomputes the promo discount from the trusted Promotions row instead of
// trusting orderData.pricing.promoDiscount. Mirrors calcPromoDiscount() in
// public/js/cart.js. Returns 0 (no error) if the promo doesn't validate —
// checkout proceeds without the discount rather than failing outright.
async function getAuthoritativePromoDiscount(pool, promoCode, subtotal, stallIds, itemNames) {
  if (!promoCode || promoCode === "NONE") return 0;

  const res = await pool
    .request()
    .input("PromoCode", sql.NVarChar(255), promoCode)
    .query(`
      SELECT PromoType, DiscountValue, MaxDiscount, MinSpend, ExpiresAt, StallId, RequiredKeyword, RedemptionsLeft
      FROM dbo.Promotions WHERE PromoCode = @PromoCode
    `);
  const promo = res.recordset[0];
  if (!promo) return 0;
  if (promo.RedemptionsLeft != null && promo.RedemptionsLeft <= 0) return 0;
  if (promo.ExpiresAt && new Date(promo.ExpiresAt) < new Date()) return 0;
  if (promo.MinSpend != null && subtotal < Number(promo.MinSpend)) return 0;
  if (promo.StallId && !stallIds.includes(promo.StallId)) return 0;
  if (promo.RequiredKeyword) {
    const kw = String(promo.RequiredKeyword).toLowerCase();
    const hasKeyword = itemNames.some((n) => String(n || "").toLowerCase().includes(kw));
    if (!hasKeyword) return 0;
  }

  const type = String(promo.PromoType || "cash").toLowerCase();
  const value = Number(promo.DiscountValue) || 0;
  let discount = 0;
  if (type === "cash") discount = value;
  else if (type === "percent") discount = subtotal * (value / 100);
  // "freebie" -> 0, matching cart.js

  if (Number(promo.MaxDiscount) > 0) discount = Math.min(discount, Number(promo.MaxDiscount));
  discount = Math.min(discount, subtotal);
  return Math.max(0, Math.round(discount * 100) / 100);
}

async function createCheckoutOrder(orderData) {
  const pool = await poolPromise;
  const userId = String(orderData.userId || "guest");
  const dbUserId = (userId === "guest" || !orderData.userId) ? null : userId;

  const items = Array.isArray(orderData.items) ? orderData.items : [];
  if (!items.length) throw new Error("Cart is empty");

  const promoCode = String(orderData.promoCode || "NONE");
  const fulfillment = String(orderData.fulfillment || "pickup");
  const paymentMethod = String(orderData.paymentMethod || "cash");
  const address = orderData.address || {};

  const user = await getUserInfo(userId);

  // Resolve every line item's real price from the DB — the client's
  // unitPrice/totalPrice are ignored from this point on.
  const resolvedItems = [];
  for (const it of items) {
    const stallId = it.stallId || "tiong-bahru";
    const qty = Math.max(1, Math.floor(Number(it.qty)) || 1);

    const { basePrice, name } = await getAuthoritativeBasePrice(
      pool,
      stallId,
      it.itemId,
      it.variantKey,
    );
    const { addons, total: addonsTotal } = await getAuthoritativeAddons(
      pool,
      stallId,
      it.addons,
    );

    const unitPrice = Math.round((basePrice + addonsTotal) * 100) / 100;
    const lineTotal = Math.round(unitPrice * qty * 100) / 100;

    resolvedItems.push({
      ...it,
      stallId,
      qty,
      name: it.name || name,
      unitPrice,
      totalPrice: lineTotal,
      addons,
    });
  }

  const groups = new Map();
  for (const it of resolvedItems) {
    if (!groups.has(it.stallId)) groups.set(it.stallId, []);
    groups.get(it.stallId).push(it);
  }
  const stallIds = Array.from(groups.keys());
  const singleStall = stallIds.length === 1;

  const stallSubtotals = new Map(
    stallIds.map((stallId) => [
      stallId,
      groups.get(stallId).reduce((s, it) => s + it.totalPrice, 0),
    ]),
  );
  const subtotal =
    Math.round(
      Array.from(stallSubtotals.values()).reduce((s, v) => s + v, 0) * 100,
    ) / 100;

  const smallOrderFee = computeSmallOrderFee(fulfillment, subtotal);
  const deliveryFee = computeDeliveryFee(fulfillment);
  const promoDiscount = await getAuthoritativePromoDiscount(
    pool,
    promoCode,
    subtotal,
    stallIds,
    resolvedItems.map((it) => it.name),
  );
  const total = Math.max(
    0,
    Math.round((subtotal - promoDiscount + smallOrderFee + deliveryFee) * 100) / 100,
  );

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

    const deliveryFeeByStall = singleStall
      ? new Map([[stallIds[0], deliveryFee]])
      : allocateByShare(deliveryFee, stallIds, stallSubtotals, subtotal);
    const smallOrderFeeByStall = singleStall
      ? new Map([[stallIds[0], smallOrderFee]])
      : allocateByShare(smallOrderFee, stallIds, stallSubtotals, subtotal);
    const promoDiscountByStall = singleStall
      ? new Map([[stallIds[0], promoDiscount]])
      : allocateByShare(promoDiscount, stallIds, stallSubtotals, subtotal);

    for (const stallId of stallIds) {
      const stallItems = groups.get(stallId);
      const stallSubtotal = stallSubtotals.get(stallId);

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

      const orderDeliveryFee = deliveryFeeByStall.get(stallId);
      const orderSmallOrderFee = smallOrderFeeByStall.get(stallId);
      const orderPromoDiscount = promoDiscountByStall.get(stallId);
      const orderTotal = singleStall
        ? total
        : Math.round(
            (stallSubtotal +
              orderDeliveryFee +
              orderSmallOrderFee -
              orderPromoDiscount) *
              100,
          ) / 100;

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