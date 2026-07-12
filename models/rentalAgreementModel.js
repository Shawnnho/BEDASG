const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");

async function getRentalAgreementsByCentre(centreId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("centreId", sql.NVarChar, centreId)
    .query(`
      SELECT
        AgreementId, StallId, OwnerUid, BillingUid, CentreId, StallCentreDocId,
        OwnerName, StallName, UnitNo, MonthlyRent, StartDate, CreatedAt, UpdatedAt
      FROM dbo.RentalAgreements
      WHERE CentreId = @centreId
      ORDER BY CreatedAt DESC;
    `);
  return result.recordset;
}

async function getRentalAgreementById(agreementId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("agreementId", sql.NVarChar, agreementId)
    .query("SELECT * FROM dbo.RentalAgreements WHERE AgreementId = @agreementId");
  return result.recordset[0] || null;
}

async function createRentalAgreement({
  stallId,
  ownerUid,
  billingUid,
  centreId,
  stallCentreDocId,
  ownerName,
  stallName,
  unitNo,
  monthlyRent,
  startDate,
}) {
  const pool = await poolPromise;
  const agreementId = crypto.randomUUID();

  await pool
    .request()
    .input("agreementId", sql.NVarChar, agreementId)
    .input("stallId", sql.NVarChar, stallId)
    .input("ownerUid", sql.NVarChar, ownerUid || null)
    .input("billingUid", sql.NVarChar, billingUid || null)
    .input("centreId", sql.NVarChar, centreId)
    .input("stallCentreDocId", sql.NVarChar, stallCentreDocId || null)
    .input("ownerName", sql.NVarChar, ownerName)
    .input("stallName", sql.NVarChar, stallName)
    .input("unitNo", sql.NVarChar, unitNo || null)
    .input("monthlyRent", sql.Decimal(10, 2), monthlyRent)
    .input("startDate", sql.Date, startDate)
    .query(`
      INSERT INTO dbo.RentalAgreements
        (AgreementId, StallId, OwnerUid, BillingUid, CentreId, StallCentreDocId,
         OwnerName, StallName, UnitNo, MonthlyRent, StartDate, CreatedAt, UpdatedAt)
      VALUES
        (@agreementId, @stallId, @ownerUid, @billingUid, @centreId, @stallCentreDocId,
         @ownerName, @stallName, @unitNo, @monthlyRent, @startDate, GETDATE(), GETDATE());
    `);

  return { agreementId };
}

async function deleteRentalAgreement(agreementId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("agreementId", sql.NVarChar, agreementId)
    .query("DELETE FROM dbo.RentalAgreements WHERE AgreementId = @agreementId");
  return result.rowsAffected[0] > 0;
}

module.exports = { 
    getRentalAgreementsByCentre, getRentalAgreementById, createRentalAgreement, deleteRentalAgreement
};