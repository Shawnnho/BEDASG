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
    .input("Price", sql.Decimal(10, 2), data.price).query(`
      INSERT INTO StallMenus
        (MenuId, StallId, Active, Available, Category, Name, Description, ImageUrl, Price, CreatedAt, UpdatedAt)
      VALUES
        (@MenuId, @StallId, 1, 1, @Category, @Name, @Description, @ImageUrl, @Price, SYSUTCDATETIME(), SYSUTCDATETIME());
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
    .input("Price", sql.Decimal(10, 2), data.price).query(`
      UPDATE StallMenus
      SET Name = @Name,
          Description = @Description,
          Category = @Category,
          ImageUrl = @ImageUrl,
          Price = @Price,
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

module.exports = {
  getMenuByStall,
  addMenuItem,
  updateMenuItem,
  toggleMenuActive,
  deleteMenuItem,
  getAddonsByStall,
  addAddon,
  updateAddon,
  deleteAddon,
};
