const { poolPromise, sql } = require("../dbConfig");

/* ===================== READ ===================== */

// User profile + linked stall (single round trip)
async function getAccount(userId) {
  const pool = await poolPromise;
  const result = await pool.request().input("UserId", sql.NVarChar(255), userId)
    .query(`
      SELECT
        u.UserId, u.Name, u.Email, u.Phone, u.AvatarUrl,
        u.UserRole, u.StallId, u.IsDeactivated,
        u.NotifNewOrders, u.NotifOrderUpdates, u.NotifNewReview, u.NotifHygiene,
        s.StallName, s.Cuisine, s.[Desc], s.ImageUrl, s.UnitNo,
        s.Phone AS StallPhone, s.HygieneGrade,
        s.PrepMin, s.PrepMax, s.IsActive,
        s.SupportsAddons, s.SupportsSizePricing,
        s.RatingCount, s.RatingTotal
      FROM Users u
      LEFT JOIN Stalls s ON s.StallId = u.StallId
      WHERE u.UserId = @UserId;
    `);
  return result.recordset[0] || null;
}

async function getStallHours(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("StallId", sql.NVarChar(255), stallId).query(`
      SELECT DayOfWeek, IsClosed, OpenTime, CloseTime
      FROM StallHours
      WHERE StallId = @StallId
      ORDER BY DayOfWeek;
    `);
  return result.recordset;
}

/* ===================== PROFILE ===================== */

async function updateProfile(userId, { name, phone, avatarUrl }) {
  const pool = await poolPromise;
  const request = pool
    .request()
    .input("UserId", sql.NVarChar(255), userId)
    .input("Name", sql.NVarChar(255), name)
    .input("Phone", sql.NVarChar(20), phone || null);

  // Only overwrite the avatar when a new one was supplied
  let avatarSet = "";
  if (avatarUrl) {
    request.input("AvatarUrl", sql.NVarChar(sql.MAX), avatarUrl);
    avatarSet = ", AvatarUrl = @AvatarUrl";
  }

  const result = await request.query(`
    UPDATE Users
    SET Name = @Name,
        Phone = @Phone
        ${avatarSet},
        UpdatedAt = SYSUTCDATETIME()
    WHERE UserId = @UserId;
  `);
  return result.rowsAffected[0];
}

async function updateNotifPrefs(userId, p) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("UserId", sql.NVarChar(255), userId)
    .input("NewOrders", sql.Bit, p.newOrders ? 1 : 0)
    .input("OrderUpdates", sql.Bit, p.orderUpdates ? 1 : 0)
    .input("NewReview", sql.Bit, p.newReview ? 1 : 0)
    .input("Hygiene", sql.Bit, p.hygiene ? 1 : 0).query(`
      UPDATE Users
      SET NotifNewOrders    = @NewOrders,
          NotifOrderUpdates = @OrderUpdates,
          NotifNewReview    = @NewReview,
          NotifHygiene      = @Hygiene,
          UpdatedAt         = SYSUTCDATETIME()
      WHERE UserId = @UserId;
    `);
  return result.rowsAffected[0];
}

/* ===================== STALL ===================== */

async function updateStall(stallId, d) {
  const pool = await poolPromise;
  const request = pool
    .request()
    .input("StallId", sql.NVarChar(255), stallId)
    .input("StallName", sql.NVarChar(255), d.stallName)
    .input("Cuisine", sql.NVarChar(255), d.cuisine || "")
    .input("Desc", sql.NVarChar(sql.MAX), d.desc || "")
    .input("UnitNo", sql.NVarChar(255), d.unitNo || "")
    .input("Phone", sql.NVarChar(255), d.phone || null)
    .input("PrepMin", sql.Int, d.prepMin ?? null)
    .input("PrepMax", sql.Int, d.prepMax ?? null)
    .input("SupportsAddons", sql.Bit, d.supportsAddons ? 1 : 0)
    .input("SupportsSizePricing", sql.Bit, d.supportsSizePricing ? 1 : 0);

  let imageSet = "";
  if (d.imageUrl) {
    request.input("ImageUrl", sql.NVarChar(sql.MAX), d.imageUrl);
    imageSet = ", ImageUrl = @ImageUrl";
  }

  const result = await request.query(`
    UPDATE Stalls
    SET StallName           = @StallName,
        Cuisine             = @Cuisine,
        [Desc]              = @Desc,
        UnitNo              = @UnitNo,
        Phone               = @Phone,
        PrepMin             = @PrepMin,
        PrepMax             = @PrepMax,
        SupportsAddons      = @SupportsAddons,
        SupportsSizePricing = @SupportsSizePricing
        ${imageSet},
        UpdatedAt           = SYSUTCDATETIME()
    WHERE StallId = @StallId;
  `);
  return result.rowsAffected[0];
}

// Delete + reinsert the 7 rows (small set; simpler than diffing)
async function replaceStallHours(stallId, days) {
  const pool = await poolPromise;

  await pool
    .request()
    .input("StallId", sql.NVarChar(255), stallId)
    .query("DELETE FROM StallHours WHERE StallId = @StallId;");

  for (const d of days) {
    const dayNum = Number(d.dayOfWeek);
    if (!Number.isInteger(dayNum) || dayNum < 0 || dayNum > 6) continue;

    const closed = !!d.isClosed;
    await pool
      .request()
      .input("StallId", sql.NVarChar(255), stallId)
      .input("DayOfWeek", sql.TinyInt, dayNum)
      .input("IsClosed", sql.Bit, closed ? 1 : 0)
      .input("OpenTime", sql.NVarChar(5), closed ? null : d.openTime || null)
      .input("CloseTime", sql.NVarChar(5), closed ? null : d.closeTime || null)
      .query(`
        INSERT INTO StallHours (StallId, DayOfWeek, IsClosed, OpenTime, CloseTime)
        VALUES (@StallId, @DayOfWeek, @IsClosed, @OpenTime, @CloseTime);
      `);
  }
}

async function setStallActive(stallId, isActive) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("StallId", sql.NVarChar(255), stallId)
    .input("IsActive", sql.Bit, isActive ? 1 : 0).query(`
      UPDATE Stalls
      SET IsActive  = @IsActive,
          UpdatedAt = SYSUTCDATETIME()
      WHERE StallId = @StallId;
    `);
  return result.rowsAffected[0];
}

/* ===================== PASSWORD (UserCredentials) ===================== */

async function getPasswordHash(userId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("UserId", sql.NVarChar(255), userId)
    .query("SELECT PasswordHash FROM UserCredentials WHERE UserId = @UserId;");
  return result.recordset[0]?.PasswordHash || null;
}

async function setPasswordHash(userId, hash) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("UserId", sql.NVarChar(255), userId)
    .input("Hash", sql.NVarChar(255), hash).query(`
      UPDATE UserCredentials
      SET PasswordHash = @Hash
      WHERE UserId = @UserId;
    `);
  return result.rowsAffected[0];
}

/* ===================== DEACTIVATE ===================== */

async function deactivateAccount(userId, stallId) {
  const pool = await poolPromise;

  await pool.request().input("UserId", sql.NVarChar(255), userId).query(`
      UPDATE Users
      SET IsDeactivated = 1,
          DeactivatedAt = SYSUTCDATETIME(),
          UpdatedAt     = SYSUTCDATETIME()
      WHERE UserId = @UserId;
    `);

  // Take the stall offline too, so customers can't order from a dead account
  if (stallId) {
    await pool.request().input("StallId", sql.NVarChar(255), stallId).query(`
        UPDATE Stalls
        SET IsActive  = 0,
            UpdatedAt = SYSUTCDATETIME()
        WHERE StallId = @StallId;
      `);
  }
}

module.exports = {
  getAccount,
  getStallHours,
  updateProfile,
  updateNotifPrefs,
  updateStall,
  replaceStallHours,
  setStallActive,
  getPasswordHash,
  setPasswordHash,
  deactivateAccount,
};
