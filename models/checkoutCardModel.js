const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");

async function createCheckoutOrder(orderData) {
    const pool = await poolPromise;
    const cleanTotal = Number(String(orderData.total).replace(/[^0-9.-]+/g, "")) || 0;
    const newOrderId = crypto.randomBytes(10).toString('hex'); 
    
    await pool.request()
        .input('OrderId', sql.NVarChar(255), newOrderId)
        .input('CustomerId', sql.NVarChar(255), String(orderData.userId || 'guest'))
        .input('TotalAmount', sql.Decimal(18, 2), cleanTotal)
        .input('Subtotal', sql.Decimal(18, 2), cleanTotal)
        .input('DeliveryFee', sql.Decimal(18, 2), 0)
        .input('SmallOrderFee', sql.Decimal(18, 2), 0)
        .input('PromoDiscount', sql.Decimal(18, 2), 0)
        .input('PromoCode', sql.NVarChar(255), 'NONE')
        .input('FulfillmentType', sql.NVarChar(255), String(orderData.fulfillment || 'pickup'))
        .input('PaymentMethod', sql.NVarChar(255), String(orderData.paymentMethod || 'Credit / Debit Card'))
        .input('OrderStatus', sql.NVarChar(255), 'pending_payment')
        .query(`
            INSERT INTO dbo.Orders (
                OrderId, 
                CustomerId, 
                TotalAmount, 
                Subtotal,
                DeliveryFee,
                SmallOrderFee,
                PromoDiscount,
                PromoCode,
                FulfillmentType, 
                PaymentMethod, 
                OrderStatus
            )
            VALUES (
                @OrderId, 
                @CustomerId, 
                @TotalAmount, 
                @Subtotal,
                @DeliveryFee,
                @SmallOrderFee,
                @PromoDiscount,
                @PromoCode,
                @FulfillmentType, 
                @PaymentMethod, 
                @OrderStatus
            )
        `);
        
    return newOrderId;
}

async function getCheckoutById(orderId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('OrderId', sql.NVarChar(255), orderId)
        .query(`
            SELECT * FROM dbo.Orders 
            WHERE OrderId = @OrderId OR CheckoutId = @OrderId
        `);
    return result.recordset[0];
}

async function markCheckoutPaid(orderId) {
    const pool = await poolPromise;
    await pool.request()
        .input('OrderId', sql.NVarChar(255), orderId)
        .input('OrderStatus', sql.NVarChar(255), 'processing')
        .input('PaymentStatus', sql.NVarChar(255), 'Paid')
        .query(`
            UPDATE dbo.Orders
            SET 
                OrderStatus = @OrderStatus, 
                PaymentStatus = @PaymentStatus
            WHERE OrderId = @OrderId OR CheckoutId = @OrderId
        `);
}

module.exports = {
    createCheckoutOrder,
    getCheckoutById,
    markCheckoutPaid
};