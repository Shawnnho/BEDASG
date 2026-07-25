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
            cartItemId: item.CartItemId,
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

    // CREATE — add a single item to the user's cart. If an identical item
    // (same stall + item + variant + addons) is already in the cart, merge
    // into it by bumping the quantity instead of creating a duplicate row.
    static async addCartItem(userId, item) {
        const pool = await poolPromise;
        const transaction = pool.transaction();

        await transaction.begin();
        try {
            let cartRes = await transaction.request().input('uid', userId).query('SELECT CartId FROM Carts WHERE UserId = @uid');
            let cartId;

            if (cartRes.recordset.length === 0) {
                cartId = 'CART_' + Date.now();
                await transaction.request()
                    .input('cid', cartId).input('uid', userId)
                    .query('INSERT INTO Carts (CartId, UserId, UpdatedAt) VALUES (@cid, @uid, GETDATE())');
            } else {
                cartId = cartRes.recordset[0].CartId;
            }

            const addonsJson = JSON.stringify(item.addons || []);

            // Look for an existing line matching stall + item + variant + addons.
            const matchRes = await transaction.request()
                .input('cid', cartId)
                .input('iid', item.itemId || null)
                .input('sid', item.stallId || null)
                .input('vkey', item.variantKey || null)
                .input('addons', addonsJson)
                .query(`
                    SELECT CartItemId, Qty, UnitPrice
                    FROM CartItems
                    WHERE CartId = @cid
                      AND ISNULL(ItemId, '') = ISNULL(@iid, '')
                      AND ISNULL(StallId, '') = ISNULL(@sid, '')
                      AND ISNULL(VariantKey, '') = ISNULL(@vkey, '')
                      AND ISNULL(Addons, '[]') = @addons
                `);

            if (matchRes.recordset.length > 0) {
                const existing = matchRes.recordset[0];
                const newQty = Number(existing.Qty) + Number(item.qty || 1);
                // Use the incoming price, not the stale stored one — if the
                // item's price changed since it was first added (e.g. a promo
                // ended), the merge should reflect the current price.
                const unitPrice = Number(item.unitPrice ?? existing.UnitPrice ?? 0);

                await transaction.request()
                    .input('cartItemId', existing.CartItemId)
                    .input('qty', newQty)
                    .input('uprice', unitPrice)
                    .input('tprice', newQty * unitPrice)
                    .input('note', item.note || null)
                    .query(`
                        UPDATE CartItems
                        SET Qty = @qty, UnitPrice = @uprice, TotalPrice = @tprice, Note = @note
                        WHERE CartItemId = @cartItemId
                    `);

                await transaction.commit();
                return existing.CartItemId;
            }

            const result = await transaction.request()
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
                .input('addons', addonsJson)
                .input('reqmods', JSON.stringify(item.required || []))
                .query(`
                    INSERT INTO CartItems 
                    (CartId, StallId, ItemId, Name, Img, Note, Qty, UnitPrice, TotalPrice, VariantKey, VariantLabel, Addons, RequiredModifiers)
                    OUTPUT INSERTED.CartItemId
                    VALUES (@cid, @sid, @iid, @name, @img, @note, @qty, @uprice, @tprice, @vkey, @vlabel, @addons, @reqmods)
                `);

            await transaction.commit();
            return result.recordset[0].CartItemId;
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    // UPDATE — change the quantity (and recomputed total) of one item.
    // Scoped by JOIN to Carts.UserId so a user can only touch their own items.
    static async updateCartItemQty(userId, cartItemId, qty) {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('uid', userId)
            .input('cartItemId', cartItemId)
            .input('qty', qty)
            .query(`
                UPDATE ci
                SET ci.Qty = @qty,
                    ci.TotalPrice = @qty * ci.UnitPrice
                FROM CartItems ci
                JOIN Carts c ON ci.CartId = c.CartId
                WHERE ci.CartItemId = @cartItemId AND c.UserId = @uid
            `);
        return result.rowsAffected[0]; // 0 = not found / not yours, 1 = updated
    }

    // DELETE — remove a single item from the cart. Same ownership scoping.
    static async deleteCartItem(userId, cartItemId) {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('uid', userId)
            .input('cartItemId', cartItemId)
            .query(`
                DELETE ci
                FROM CartItems ci
                JOIN Carts c ON ci.CartId = c.CartId
                WHERE ci.CartItemId = @cartItemId AND c.UserId = @uid
            `);
        return result.rowsAffected[0]; // 0 = not found / not yours, 1 = deleted
    }
}
module.exports = CartModel;