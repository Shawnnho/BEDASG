const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");

function genId(prefix, len = 10) {
  return `${prefix}${crypto.randomBytes(len).toString("hex")}`;
}

// ── Operating-hours guard ──────────────────────────────────────────────
// Stalls store per-day hours in OperatingHours (JSON, 24h, keyed mon..sun)
// with OpenTime/CloseTime ("7:00 AM" style) as a fallback. A missing day
// key means closed that day. All comparisons use Singapore local time,
// since order timestamps are stored in UTC (SYSUTCDATETIME()).
function hhmmToMins(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function to24h(t) {
  const m = String(t)
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

// Returns { open: boolean, window: "07:00–21:00" | null } for a stall,
// evaluated against the current time in Singapore.
function getStallOpenState(operatingHours, openTime, closeTime) {
  const now = new Date();
  const sg = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Singapore" }),
  );
  const dayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][sg.getDay()];
  const nowMins = sg.getHours() * 60 + sg.getMinutes();

  let open, close;
  let parsed = operatingHours;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }

  if (parsed && typeof parsed === "object") {
    const today = parsed[dayKey];
    if (!today || !today.open || !today.close)
      return { open: false, window: null };
    open = today.open;
    close = today.close;
  } else if (openTime && closeTime) {
    open = to24h(openTime);
    close = to24h(closeTime);
    if (!open || !close) return { open: true, window: null }; // unparseable → don't block
  } else {
    return { open: true, window: null }; // no hours configured → don't block
  }

  const o = hhmmToMins(open);
  const c = hhmmToMins(close);
  const isOpen =
    c > o
      ? nowMins >= o && nowMins < c // normal same-day window
      : nowMins >= o || nowMins < c; // overnight window (closes after midnight)

  return { open: isOpen, window: `${open}–${close}` };
}

// Throws a STALL_CLOSED error if any stall in the checkout is outside its
// opening hours. Reads the normalized StallHours table (the same table the
// stall-account editor writes to). Falls back to the Stalls.OperatingHours
// JSON only when a stall has no StallHours rows. Called before the DB
// transaction so nothing is written.
async function assertStallsOpen(pool, stallIds) {
  // Current Singapore day + minutes (order timestamps are stored UTC).
  const sg = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Singapore" }),
  );
  const dayNum = sg.getDay(); // 0=Sun .. 6=Sat, matches StallHours.DayOfWeek
  const nowMins = sg.getHours() * 60 + sg.getMinutes();

  function minsOpen(openTime, closeTime) {
    const o = hhmmToMins(openTime);
    const c = hhmmToMins(closeTime);
    return c > o
      ? nowMins >= o && nowMins < c // normal same-day window
      : nowMins >= o || nowMins < c; // overnight window (closes after midnight)
  }

  for (const stallId of stallIds) {
    // Look up today's StallHours row (if any) alongside the stall name and
    // the legacy JSON, in one query.
    const res = await pool
      .request()
      .input("StallId", sql.NVarChar(255), stallId)
      .input("DayOfWeek", sql.TinyInt, dayNum)
      .query(`
        SELECT
          s.StallName,
          s.OpenTime, s.CloseTime, s.OperatingHours,
          h.IsClosed, h.OpenTime AS HrOpen, h.CloseTime AS HrClose,
          (SELECT COUNT(*) FROM dbo.StallHours WHERE StallId = s.StallId) AS HoursRowCount
        FROM dbo.Stalls s
        LEFT JOIN dbo.StallHours h
          ON h.StallId = s.StallId AND h.DayOfWeek = @DayOfWeek
        WHERE s.StallId = @StallId
      `);
    const row = res.recordset[0];
    if (!row) continue; // stall row missing → let downstream logic handle it

    const name = row.StallName || stallId;

    if (row.HoursRowCount > 0) {
      // StallHours is the source of truth for this stall.
      // No row for today, explicitly closed, or missing times → closed.
      const closed =
        row.IsClosed === true ||
        row.IsClosed === 1 ||
        !row.HrOpen ||
        !row.HrClose;

      if (closed) {
        const err = new Error(
          `${name} is closed today. Orders can only be placed during opening hours.`,
        );
        err.code = "STALL_CLOSED";
        throw err;
      }

      if (!minsOpen(row.HrOpen, row.HrClose)) {
        const err = new Error(
          `${name} is currently closed (today's hours: ${row.HrOpen}–${row.HrClose}). Orders can only be placed during opening hours.`,
        );
        err.code = "STALL_CLOSED";
        throw err;
      }
    } else {
      // Fallback: no StallHours rows → use the legacy OperatingHours JSON.
      const { open, window } = getStallOpenState(
        row.OperatingHours,
        row.OpenTime,
        row.CloseTime,
      );
      if (!open) {
        const err = new Error(
          window
            ? `${name} is currently closed (today's hours: ${window}). Orders can only be placed during opening hours.`
            : `${name} is closed today. Orders can only be placed during opening hours.`,
        );
        err.code = "STALL_CLOSED";
        throw err;
      }
    }
  }
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
    .query(
      "SELECT VariantKey, Price FROM dbo.StallMenuPrices WHERE MenuId = @MenuId",
    );
  const variants = variantsRes.recordset;

  if (variants.length > 0) {
    const variant = variants.find((v) => v.VariantKey === variantKey);
    if (!variant)
      throw new Error(`Invalid variant "${variantKey}" for item ${itemId}`);
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
async function getAuthoritativePromoDiscount(
  pool,
  promoCode,
  subtotal,
  stallIds,
  itemNames,
) {
  if (!promoCode || promoCode === "NONE") return 0;

  const res = await pool
    .request()
    .input("PromoCode", sql.NVarChar(255), promoCode).query(`
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
    const hasKeyword = itemNames.some((n) =>
      String(n || "")
        .toLowerCase()
        .includes(kw),
    );
    if (!hasKeyword) return 0;
  }

  const type = String(promo.PromoType || "cash").toLowerCase();
  const value = Number(promo.DiscountValue) || 0;
  let discount = 0;
  if (type === "cash") discount = value;
  else if (type === "percent") discount = subtotal * (value / 100);
  // "freebie" -> 0, matching cart.js

  if (Number(promo.MaxDiscount) > 0)
    discount = Math.min(discount, Number(promo.MaxDiscount));
  discount = Math.min(discount, subtotal);
  return Math.max(0, Math.round(discount * 100) / 100);
}

async function createCheckoutOrder(orderData) {
  const pool = await poolPromise;
  const userId = String(orderData.userId || "guest");
  const dbUserId = userId === "guest" || !orderData.userId ? null : userId;

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

  // No ordering outside a stall's operating hours. Checked here (before the
  // transaction) so a closed stall rejects the whole checkout cleanly with
  // nothing written. Throws err.code === "STALL_CLOSED" for the controller.
  await assertStallsOpen(pool, stallIds);

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
    Math.round((subtotal - promoDiscount + smallOrderFee + deliveryFee) * 100) /
      100,
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
      .input("OrderIds", sql.NVarChar(sql.MAX), "[]").query(`
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
      } catch {}

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
        .input("PromoDiscount", sql.Decimal(18, 2), orderPromoDiscount).query(`
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
          ).query(`
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
        .input("PaymentRef", sql.NVarChar(255), paymentRef || null).query(`
          UPDATE dbo.Checkouts
          SET Status = 'paid', PaymentStatus = 'paid', PaymentRef = @PaymentRef,
              PaymentPaidAt = SYSUTCDATETIME()
          WHERE CheckoutId = @CheckoutId
        `);

      await transaction
        .request()
        .input("CheckoutId", sql.NVarChar(255), checkoutId)
        .input("PaymentRef", sql.NVarChar(255), paymentRef || null).query(`
          UPDATE dbo.Orders
          SET OrderStatus = 'processing', PaymentStatus = 'Paid', PaymentRef = @PaymentRef,
              PaidAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
          WHERE CheckoutId = @CheckoutId
        `);
    } else {
      await transaction
        .request()
        .input("OrderId", sql.NVarChar(255), id)
        .input("PaymentRef", sql.NVarChar(255), paymentRef || null).query(`
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