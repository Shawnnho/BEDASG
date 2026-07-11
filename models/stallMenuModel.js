const { poolPromise, sql } = require("../dbConfig");
const crypto = require("crypto");

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

/* ===================== MENU ITEMS ===================== */

async function getMenuByStall(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("StallId", sql.NVarChar(255), stallId).query(`
      SELECT
        MenuId, StallId, Active, Available, Category,
        Name, Description, ImageUrl, Price, PriceFrom,
        CreatedAt, UpdatedAt
      FROM StallMenus
      WHERE StallId = @StallId
      ORDER BY CreatedAt DESC;
    `);
  return result.recordset;
}

async function addMenuItem(stallId, data) {
  const pool = await poolPromise;
  const menuId = newId("menu");
  await pool
    .request()
    .input("MenuId", sql.NVarChar(255), menuId)
    .input("StallId", sql.NVarChar(255), stallId)
    .input("Name", sql.NVarChar(255), data.name)
    .input("Description", sql.NVarChar(sql.MAX), data.description || "")
    .input("Category", sql.NVarChar(100), data.category || "")
    .input("ImageUrl", sql.NVarChar(sql.MAX), data.imageUrl || "")
    .input("Price", sql.Decimal(10, 2), data.price ?? null)
    .input("PriceFrom", sql.Decimal(10, 2), data.priceFrom ?? null).query(`
      INSERT INTO StallMenus
        (MenuId, StallId, Active, Available, Category, Name, Description, ImageUrl, Price, PriceFrom, CreatedAt, UpdatedAt)
      VALUES
        (@MenuId, @StallId, 1, 1, @Category, @Name, @Description, @ImageUrl, @Price, @PriceFrom, SYSUTCDATETIME(), SYSUTCDATETIME());
    `);
  return menuId;
}

async function updateMenuItem(menuId, stallId, data) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("MenuId", sql.NVarChar(255), menuId)
    .input("StallId", sql.NVarChar(255), stallId)
    .input("Name", sql.NVarChar(255), data.name)
    .input("Description", sql.NVarChar(sql.MAX), data.description || "")
    .input("Category", sql.NVarChar(100), data.category || "")
    .input("ImageUrl", sql.NVarChar(sql.MAX), data.imageUrl || "")
    .input("Price", sql.Decimal(10, 2), data.price ?? null)
    .input("PriceFrom", sql.Decimal(10, 2), data.priceFrom ?? null).query(`
      UPDATE StallMenus
      SET Name = @Name,
          Description = @Description,
          Category = @Category,
          ImageUrl = @ImageUrl,
          Price = @Price,
          PriceFrom = @PriceFrom,
          UpdatedAt = SYSUTCDATETIME()
      WHERE MenuId = @MenuId AND StallId = @StallId;
    `);
  return result.rowsAffected[0];
}

// Toggle Active + Available together (matches old behaviour)
async function toggleMenuActive(menuId, stallId, isActive) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("MenuId", sql.NVarChar(255), menuId)
    .input("StallId", sql.NVarChar(255), stallId)
    .input("Active", sql.Bit, isActive ? 1 : 0).query(`
      UPDATE StallMenus
      SET Active = @Active,
          Available = @Active,
          UpdatedAt = SYSUTCDATETIME()
      WHERE MenuId = @MenuId AND StallId = @StallId;
    `);
  return result.rowsAffected[0];
}

async function deleteMenuItem(menuId, stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("MenuId", sql.NVarChar(255), menuId)
    .input("StallId", sql.NVarChar(255), stallId).query(`
      DELETE FROM StallMenus
      WHERE MenuId = @MenuId AND StallId = @StallId;
    `);
  return result.rowsAffected[0];
}

/* ===================== ADD-ONS ===================== */

async function getAddonsByStall(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("StallId", sql.NVarChar(255), stallId).query(`
      SELECT AddonId, StallId, Active, Name, Price, CreatedAt, UpdatedAt
      FROM StallAddons
      WHERE StallId = @StallId
      ORDER BY CreatedAt DESC;
    `);
  return result.recordset;
}

async function addAddon(stallId, data) {
  const pool = await poolPromise;
  const addonId = newId("addon");
  await pool
    .request()
    .input("AddonId", sql.NVarChar(255), addonId)
    .input("StallId", sql.NVarChar(255), stallId)
    .input("Name", sql.NVarChar(255), data.name)
    .input("Price", sql.Decimal(10, 2), data.price ?? 0).query(`
      INSERT INTO StallAddons
        (AddonId, StallId, Active, Name, Price, CreatedAt, UpdatedAt)
      VALUES
        (@AddonId, @StallId, 1, @Name, @Price, SYSUTCDATETIME(), SYSUTCDATETIME());
    `);
  return addonId;
}

async function updateAddon(addonId, stallId, data) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("AddonId", sql.NVarChar(255), addonId)
    .input("StallId", sql.NVarChar(255), stallId)
    .input("Name", sql.NVarChar(255), data.name)
    .input("Price", sql.Decimal(10, 2), data.price ?? 0).query(`
      UPDATE StallAddons
      SET Name = @Name,
          Price = @Price,
          UpdatedAt = SYSUTCDATETIME()
      WHERE AddonId = @AddonId AND StallId = @StallId;
    `);
  return result.rowsAffected[0];
}

async function deleteAddon(addonId, stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("AddonId", sql.NVarChar(255), addonId)
    .input("StallId", sql.NVarChar(255), stallId).query(`
      DELETE FROM StallAddons
      WHERE AddonId = @AddonId AND StallId = @StallId;
    `);
  return result.rowsAffected[0];
}

/* ===================== VARIANT PRICES ===================== */

// Get all variant prices for a set of menu ids (one query, grouped in JS)
async function getPricesForMenus(menuIds) {
  if (!menuIds.length) return [];
  const pool = await poolPromise;
  const request = pool.request();

  const params = menuIds.map((id, i) => {
    request.input(`m${i}`, sql.NVarChar(255), id);
    return `@m${i}`;
  });

  const result = await request.query(`
    SELECT MenuPriceId, MenuId, VariantKey, Price
    FROM StallMenuPrices
    WHERE MenuId IN (${params.join(",")})
    ORDER BY MenuPriceId ASC;
  `);
  return result.recordset;
}

// Replace all variant prices for one item (delete + reinsert = simplest correct approach)
async function replaceMenuPrices(menuId, variants) {
  const pool = await poolPromise;

  // clear existing
  await pool
    .request()
    .input("MenuId", sql.NVarChar(255), menuId)
    .query("DELETE FROM StallMenuPrices WHERE MenuId = @MenuId;");

  // insert new set
  for (const v of variants) {
    const key = String(v.variantKey || "")
      .trim()
      .toLowerCase();
    const price = Number(v.price);
    if (!key || !Number.isFinite(price) || price < 0) continue;

    await pool
      .request()
      .input("MenuId", sql.NVarChar(255), menuId)
      .input("VariantKey", sql.NVarChar(50), key)
      .input("Price", sql.Decimal(10, 2), price).query(`
        IF NOT EXISTS (
          SELECT 1 FROM StallMenuPrices
          WHERE MenuId = @MenuId AND VariantKey = @VariantKey
        )
        INSERT INTO StallMenuPrices (MenuId, VariantKey, Price)
        VALUES (@MenuId, @VariantKey, @Price);
      `);
  }
}

// Set Price / PriceFrom on the item itself based on pricing mode
async function setMenuPricing(menuId, stallId, { price, priceFrom }) {
  const pool = await poolPromise;
  await pool
    .request()
    .input("MenuId", sql.NVarChar(255), menuId)
    .input("StallId", sql.NVarChar(255), stallId)
    .input("Price", sql.Decimal(10, 2), price)
    .input("PriceFrom", sql.Decimal(10, 2), priceFrom).query(`
      UPDATE StallMenus
      SET Price = @Price,
          PriceFrom = @PriceFrom,
          UpdatedAt = SYSUTCDATETIME()
      WHERE MenuId = @MenuId AND StallId = @StallId;
    `);
}

// Distinct variant keys this stall already uses (for suggestions in the UI)
async function getVariantKeysByStall(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("StallId", sql.NVarChar(255), stallId).query(`
      SELECT DISTINCT p.VariantKey
      FROM StallMenuPrices p
      JOIN StallMenus m ON m.MenuId = p.MenuId
      WHERE m.StallId = @StallId
      ORDER BY p.VariantKey;
    `);
  return result.recordset.map((r) => r.VariantKey);
}

module.exports = {
  getMenuByStall,
  addMenuItem,
  updateMenuItem,
  toggleMenuActive,
  deleteMenuItem,
  getPricesForMenus,
  replaceMenuPrices,
  setMenuPricing,
  getVariantKeysByStall,
  getAddonsByStall,
  addAddon,
  updateAddon,
  deleteAddon,
};
