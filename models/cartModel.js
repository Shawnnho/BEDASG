const { poolPromise } = require('../dbConfig');

class CartModel {
    static async getCartItems(userId) {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('uid', userId)
            .query(`
                SELECT i.* FROM CartItems i
                JOIN Carts c ON i.CartId = c.CartId
                WHERE c.UserId = @uid
            `);
        
        // Map SQL columns back to the JavaScript object format cart.js expects
        return result.recordset.map(item => ({
            itemId: item.ItemId,
            stallId: item.StallId,
            name: item.Name,
            img: item.Img,
            note: item.Note,
            qty: item.Qty,
            unitPrice: item.UnitPrice,
            totalPrice: item.TotalPrice,
            variantKey: item.VariantKey,
            variantLabel: item.VariantLabel,
            addons: item.Addons ? JSON.parse(item.Addons) : [],
            required: item.RequiredModifiers ? JSON.parse(item.RequiredModifiers) : []
        }));
    }

    static async updateCartItems(userId, items) {
        const pool = await poolPromise;
        const transaction = pool.transaction();
        
        await transaction.begin();
        try {
            // 1. Get or create CartId for this user
            let cartRes = await transaction.request().input('uid', userId).query('SELECT CartId FROM Carts WHERE UserId = @uid');
            let cartId;
            
            if (cartRes.recordset.length === 0) {
                cartId = 'CART_' + Date.now(); // Generate a simple ID
                await transaction.request()
                    .input('cid', cartId).input('uid', userId)
                    .query('INSERT INTO Carts (CartId, UserId, UpdatedAt) VALUES (@cid, @uid, GETDATE())');
            } else {
                cartId = cartRes.recordset[0].CartId;
            }

            // 2. Clear old items
            await transaction.request().input('cid', cartId).query('DELETE FROM CartItems WHERE CartId = @cid');

            // 3. Insert new items
            for (const item of items) {
                await transaction.request()
                    .input('cid', cartId)
                    .input('sid', item.stallId || null)
                    .input('iid', item.itemId || null)
                    .input('name', item.name)
                    .input('img', item.img)
                    .input('note', item.note || null)
                    .input('qty', item.qty)
                    .input('uprice', item.unitPrice)
                    .input('tprice', item.totalPrice)
                    .input('vkey', item.variantKey || null)
                    .input('vlabel', item.variantLabel || null)
                    .input('addons', JSON.stringify(item.addons || []))
                    .input('reqmods', JSON.stringify(item.required || []))
                    .query(`
                        INSERT INTO CartItems 
                        (CartId, StallId, ItemId, Name, Img, Note, Qty, UnitPrice, TotalPrice, VariantKey, VariantLabel, Addons, RequiredModifiers)
                        VALUES (@cid, @sid, @iid, @name, @img, @note, @qty, @uprice, @tprice, @vkey, @vlabel, @addons, @reqmods)
                    `);
            }
            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }
}
module.exports = CartModel;