const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");

async function getAllStalls() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT
      s.StallId,
      s.CentreId,
      s.StallName,
      s.Cuisine,
      s.HygieneGrade,
      s.PrepMin,
      s.PrepMax,
      s.IsPopular,
      s.ImageUrl,
      s.[Desc],
      s.UnitNo,
      c.Name AS CentreName
    FROM dbo.Stalls s
    INNER JOIN dbo.Centres c ON s.CentreId = c.CentreId
    WHERE s.IsActive = 1
      AND s.IsCanonical = 1
    ORDER BY s.StallName;
  `);
  return result.recordset;
}

// Generates a unit number unique within the given centre (e.g. 01-001, 01-002...),
// retrying a few times in the rare case two storeholders sign up for the same
// centre at nearly the same moment.
async function generateUnitNoForCentre(pool, centreId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const countResult = await pool
      .request()
      .input("centreId", sql.NVarChar, centreId)
      .query("SELECT COUNT(*) AS cnt FROM dbo.Stalls WHERE CentreId = @centreId");

    const next = countResult.recordset[0].cnt + 1 + attempt;
    const candidate = `01-${String(next).padStart(3, "0")}`;

    const existsResult = await pool
      .request()
      .input("centreId", sql.NVarChar, centreId)
      .input("unitNo", sql.NVarChar, candidate)
      .query(
        "SELECT 1 FROM dbo.Stalls WHERE CentreId = @centreId AND UnitNo = @unitNo",
      );

    if (existsResult.recordset.length === 0) return candidate;
  }
  throw new Error("Could not generate a unique unit number for this centre");
}

// Called during storeholder registration. New stalls start inactive/unset-up
// (IsActive = 0, HasSetup = 0) until the storeholder finishes onboarding —
// they shouldn't appear as orderable to customers immediately after signup.
async function createStall({ ownerUid, centreId, stallName, cuisine, phone }) {
  const pool = await poolPromise;
  const unitNo = await generateUnitNoForCentre(pool, centreId);
  const stallId = crypto.randomUUID();

  await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .input("ownerUid", sql.NVarChar, ownerUid)
    .input("centreId", sql.NVarChar, centreId)
    .input("stallName", sql.NVarChar, stallName)
    .input("cuisine", sql.NVarChar, cuisine)
    .input("unitNo", sql.NVarChar, unitNo)
    .input("phone", sql.NVarChar, phone || null)
    .query(`
      INSERT INTO dbo.Stalls
        (StallId, OwnerUid, CentreId, StallName, Cuisine, UnitNo, Phone, IsActive, HasMenu, HasSetup)
      VALUES
        (@stallId, @ownerUid, @centreId, @stallName, @cuisine, @unitNo, @phone, 0, 0, 0)
    `);

  return { stallId, unitNo };
}

async function getStallById(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT
        s.StallId,
        s.PublicStallId,
        s.CentreId,
        s.StallName,
        s.Cuisine,
        s.[Desc],
        s.ImageUrl,
        s.HygieneGrade,
        s.UnitNo,
        s.Phone,
        s.OpenTime,
        s.CloseTime,
        s.OperatingHours,
        s.PrepMin,
        s.PrepMax,
        s.RatingCount,
        s.IsPopular
      FROM dbo.Stalls s
      WHERE s.StallId = @stallId
        AND s.IsActive = 1
        AND s.IsCanonical = 1
    `);

  return result.recordset[0];
}

module.exports = { getAllStalls, createStall, getStallById };
