const { sql, poolPromise } = require("../dbConfig");

function computeBillId(stallId, billMonth) {
  return `${stallId}_${billMonth}`;
}

function serverMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}


function computeDueDate(billMonth) {
  const [yy, mm] = billMonth.split("-").map(Number);
  let dueDate = new Date(yy, mm - 1, 15);

  const now = new Date();
  if (billMonth === serverMonthKey() && now > dueDate) {
    dueDate = new Date(yy, mm, 15);
  }
  return dueDate;
}

async function getBill(stallId, billMonth) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .input("billMonth", sql.NVarChar, billMonth)
    .query(`
      SELECT TOP 1 *
      FROM dbo.OperatorBills
      WHERE StallId = @stallId AND BillMonth = @billMonth
    `);
  return result.recordset[0] || null;
}

async function getLatestBillForStall(stallId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT TOP 1 *
      FROM dbo.OperatorBills
      WHERE StallId = @stallId
      ORDER BY BillMonth DESC;
    `);
  return result.recordset[0] || null;
}

async function ensureBill(stallId, centreId, billMonth, defaultRent) {
  const existing = await getBill(stallId, billMonth);
  if (existing) return existing;

  const pool = await poolPromise;
  const billId = computeBillId(stallId, billMonth);
  const dueDate = computeDueDate(billMonth);

  try {
    await pool
      .request()
      .input("billId", sql.NVarChar, billId)
      .input("stallId", sql.NVarChar, stallId)
      .input("centreId", sql.NVarChar, centreId)
      .input("billMonth", sql.NVarChar, billMonth)
      .input("rentAmount", sql.Decimal(10, 2), defaultRent || 0)
      .input("dueDate", sql.DateTime, dueDate)
      .query(`
        INSERT INTO dbo.OperatorBills
          (BillId, StallId, CentreId, BillMonth, BillStatus, IsPaid,
           RentAmount, CleaningFee, Utilities, OtherCharges, Penalty, TotalAmount,
           DueDate, CreatedAt, UpdatedAt)
        VALUES
          (@billId, @stallId, @centreId, @billMonth, NULL, 0,
           @rentAmount, 0, 0, 0, 0, @rentAmount,
           @dueDate, GETDATE(), GETDATE());
      `);
  } catch (err) {
  
    const isDuplicateKey =
      err.number === 2627 ||
      err.number === 2601 ||
      /violation of unique key constraint/i.test(err.message || "") ||
      /cannot insert duplicate key/i.test(err.message || "");

    if (isDuplicateKey) {
      const existingAfterRace = await getBill(stallId, billMonth);
      if (existingAfterRace) return existingAfterRace;
    }
    throw err;
  }

  return getBill(stallId, billMonth);
}


async function updateBill(stallId, billMonth, centreId, { rent, utilities, cleaningFee, penalty, other }) {
  const pool = await poolPromise;
  const billId = computeBillId(stallId, billMonth);
  const total =
    Number(rent || 0) +
    Number(utilities || 0) +
    Number(cleaningFee || 0) +
    Number(penalty || 0) +
    Number(other || 0);

  const existing = await getBill(stallId, billMonth);

  if (existing) {
    await pool
      .request()
      .input("billId", sql.NVarChar, billId)
      .input("rent", sql.Decimal(10, 2), rent)
      .input("utilities", sql.Decimal(10, 2), utilities)
      .input("cleaningFee", sql.Decimal(10, 2), cleaningFee)
      .input("penalty", sql.Decimal(10, 2), penalty)
      .input("other", sql.Decimal(10, 2), other)
      .input("total", sql.Decimal(10, 2), total)
      .query(`
        UPDATE dbo.OperatorBills
        SET RentAmount = @rent, Utilities = @utilities, CleaningFee = @cleaningFee,
            Penalty = @penalty, OtherCharges = @other, TotalAmount = @total,
            UpdatedAt = GETDATE()
        WHERE BillId = @billId;
      `);
  } else {
    const dueDate = computeDueDate(billMonth);

    await pool
      .request()
      .input("billId", sql.NVarChar, billId)
      .input("stallId", sql.NVarChar, stallId)
      .input("centreId", sql.NVarChar, centreId)
      .input("billMonth", sql.NVarChar, billMonth)
      .input("rent", sql.Decimal(10, 2), rent)
      .input("utilities", sql.Decimal(10, 2), utilities)
      .input("cleaningFee", sql.Decimal(10, 2), cleaningFee)
      .input("penalty", sql.Decimal(10, 2), penalty)
      .input("other", sql.Decimal(10, 2), other)
      .input("total", sql.Decimal(10, 2), total)
      .input("dueDate", sql.DateTime, dueDate)
      .query(`
        INSERT INTO dbo.OperatorBills
          (BillId, StallId, CentreId, BillMonth, BillStatus, IsPaid,
           RentAmount, Utilities, CleaningFee, Penalty, OtherCharges, TotalAmount,
           DueDate, CreatedAt, UpdatedAt)
        VALUES
          (@billId, @stallId, @centreId, @billMonth, NULL, 0,
           @rent, @utilities, @cleaningFee, @penalty, @other, @total,
           @dueDate, GETDATE(), GETDATE());
      `);
  }

  return getBill(stallId, billMonth);
}

module.exports = { getBill, getLatestBillForStall, ensureBill, updateBill, computeBillId };