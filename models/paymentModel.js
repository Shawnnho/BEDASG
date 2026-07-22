const { sql, poolPromise } = require("../dbConfig");
const crypto = require("crypto");

/**
 * Resolve the stall a logged-in storeholder owns, from their userId.
 * Primary link: Users.StallId -> Stalls.StallId
 * Security check: the resolved stall's OwnerUid must equal the userId.
 * Returns { stallId, publicStallId, centreId, stallName } or null.
 */
async function getStallForOwner(userId) {
  const pool = await poolPromise;
  const result = await pool.request().input("userId", sql.NVarChar, userId)
    .query(`
      SELECT
        s.StallId,
        s.PublicStallId,
        s.CentreId,
        s.StallName,
        u.Name AS OwnerName
      FROM dbo.Users u
      INNER JOIN dbo.Stalls s ON s.StallId = u.StallId
      WHERE u.UserId = @userId
        AND s.OwnerUid = u.UserId
    `);

  return result.recordset[0] || null;
}

/**
 * Rental agreement for a stall (fixed monthly rent lives here).
 * Returns the row or null.
 */
async function getAgreementByStallId(stallId) {
  const pool = await poolPromise;
  const result = await pool.request().input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT TOP 1
        AgreementId,
        StallId,
        MonthlyRent,
        StartDate
      FROM dbo.RentalAgreements
      WHERE StallId = @stallId
      ORDER BY CreatedAt DESC
    `);

  return result.recordset[0] || null;
}

/**
 * Operator bill for a given stall + month (yyyy-mm).
 * Returns the row or null.
 */
async function getOperatorBill(stallId, month) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .input("month", sql.NVarChar, month).query(`
      SELECT
        BillId,
        StallId,
        CentreId,
        BillMonth,
        BillStatus,
        IsPaid,
        RentAmount,
        CleaningFee,
        Utilities,
        OtherCharges,
        Penalty,
        TotalAmount,
        DueDate,
        PaidAt,
        CreatedAt,
        UpdatedAt
      FROM dbo.OperatorBills
      WHERE StallId = @stallId
        AND BillMonth = @month
    `);

  return result.recordset[0] || null;
}

/**
 * Ensure an operator bill row exists for the month. If missing, seed one
 * from the rental agreement's MonthlyRent with a default due date (15th).
 * Returns the (existing or newly created) bill row.
 */
async function ensureOperatorBill(stallId, centreId, month) {
  const existing = await getOperatorBill(stallId, month);
  if (existing) return existing;

  const pool = await poolPromise;
  const agreement = await getAgreementByStallId(stallId);
  const rent = Number(agreement?.MonthlyRent) || 0;

  const [y, m] = month.split("-");
  // Bill issued on the 1st, due on the 7th (1-week grace).
  const dueDate = new Date(Number(y), Number(m) - 1, 7, 23, 59, 59, 999);

  const billId = crypto.randomUUID();

  await pool
    .request()
    .input("billId", sql.NVarChar, billId)
    .input("stallId", sql.NVarChar, stallId)
    .input("centreId", sql.NVarChar, centreId || null)
    .input("month", sql.NVarChar, month)
    .input("rent", sql.Decimal(18, 2), rent)
    .input("total", sql.Decimal(18, 2), rent)
    .input("dueDate", sql.DateTime2, dueDate).query(`
      INSERT INTO dbo.OperatorBills
        (BillId, StallId, CentreId, BillMonth, BillStatus, IsPaid,
         RentAmount, CleaningFee, Utilities, OtherCharges, Penalty,
         TotalAmount, DueDate, CreatedAt, UpdatedAt)
      VALUES
        (@billId, @stallId, @centreId, @month, 'unpaid', 0,
         @rent, 0, 0, 0, 0,
         @total, @dueDate, GETDATE(), GETDATE())
    `);

  return await getOperatorBill(stallId, month);
}

/**
 * Mark an operator bill as paid. Only affects the given stall's bill.
 * Returns true if a row was updated.
 */
async function markOperatorBillPaid(stallId, month) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .input("month", sql.NVarChar, month).query(`
      UPDATE dbo.OperatorBills
      SET BillStatus = 'paid',
          IsPaid = 1,
          PaidAt = GETDATE(),
          UpdatedAt = GETDATE()
      WHERE StallId = @stallId
        AND BillMonth = @month
        AND (IsPaid = 0 OR IsPaid IS NULL)
    `);

  return result.rowsAffected[0] > 0;
}

/**
 * Single source of truth for the monthly bill's status for a stall.
 * The bill (OperatorBills) is the one thing the owner pays and is paywalled
 * on. Issued on the 1st, due on the 7th. Returns computed state for the
 * current (or given) month, or null if the stall has no stall record.
 */
async function getBillStatusForStall(stallId, centreId, month) {
  const d = new Date();
  const currentMonth =
    month || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  // Ensure a bill row exists for the month (seeds rent from the agreement).
  const billRow = await ensureOperatorBill(stallId, centreId, currentMonth);
  if (!billRow) return null;

  const rent = Number(billRow.RentAmount) || 0;
  const utilities = Number(billRow.Utilities) || 0;
  const cleaningFee = Number(billRow.CleaningFee) || 0;
  const penalty = Number(billRow.Penalty) || 0;
  const other = Number(billRow.OtherCharges) || 0;
  const total =
    Number(billRow.TotalAmount) ||
    rent + utilities + cleaningFee + penalty + other;

  const isPaid = !!billRow.IsPaid;

  const [y, m] = currentMonth.split("-").map(Number);
  const dueDate = billRow.DueDate
    ? new Date(billRow.DueDate)
    : new Date(y, m - 1, 7, 23, 59, 59, 999);

  const now = new Date();
  const isOverdue = !isPaid && now > dueDate;

  // Reminder window: due within N days, or already overdue, while unpaid.
  const REMINDER_DAYS = 7;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilDue = Math.ceil((dueDate - now) / msPerDay);
  const inReminderWindow = !isPaid && daysUntilDue <= REMINDER_DAYS;

  return {
    stallId,
    month: currentMonth,
    rent,
    utilities,
    cleaningFee,
    penalty,
    other,
    total,
    dueDate,
    isPaid,
    isOverdue,
    daysUntilDue,
    inReminderWindow,
    status: isPaid ? "paid" : isOverdue ? "overdue" : "unpaid",
    paidAt: billRow.PaidAt || null,
  };
}

/**
 * Insert a payment record.
 */
async function addPayment({
  stallId,
  amount,
  method,
  month,
  payTo,
  note,
  createdBy,
}) {
  const pool = await poolPromise;
  const paymentId = crypto.randomUUID();

  await pool
    .request()
    .input("paymentId", sql.NVarChar, paymentId)
    .input("stallId", sql.NVarChar, stallId)
    .input("amount", sql.Decimal(18, 2), Number(amount) || 0)
    .input("method", sql.NVarChar, method || null)
    .input("month", sql.NVarChar, month || null)
    .input("payTo", sql.NVarChar, payTo || null)
    .input("note", sql.NVarChar, note || null)
    .input("createdBy", sql.NVarChar, createdBy || null).query(`
      INSERT INTO dbo.Payments
        (PaymentId, StallId, Amount, PaymentMethod, PaymentMonth, PayTo, Note, CreatedBy, CreatedAt)
      VALUES
        (@paymentId, @stallId, @amount, @method, @month, @payTo, @note, @createdBy, GETDATE())
    `);

  return paymentId;
}

/**
 * Payment history for a stall in a given month, newest first.
 */
async function getPaymentsForMonth(stallId, month) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("stallId", sql.NVarChar, stallId)
    .input("month", sql.NVarChar, month).query(`
      SELECT TOP 50
        PaymentId,
        StallId,
        Amount,
        PaymentMethod,
        PaymentMonth,
        PayTo,
        Note,
        CreatedBy,
        CreatedAt
      FROM dbo.Payments
      WHERE StallId = @stallId
        AND PaymentMonth = @month
      ORDER BY CreatedAt DESC
    `);

  return result.recordset;
}

/**
 * Total ever paid to the operator for a stall (across all months).
 */
async function getOperatorPaidLifetime(stallId) {
  const pool = await poolPromise;
  const result = await pool.request().input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT ISNULL(SUM(Amount), 0) AS Total
      FROM dbo.Payments
      WHERE StallId = @stallId
        AND PayTo = 'operator'
    `);

  return Number(result.recordset[0]?.Total) || 0;
}

/* ============================================================
   Rental Agreement — paywall / upcoming-payment story
   ============================================================ */

// yyyy-mm for "now" (server time).
function serverMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Full rental-agreement status for a stall, with month-rollover handling.
 *
 * If LastPaidMonth is behind the current month, the row is effectively
 * unpaid for the new month even if RentStatus still says 'paid' from last
 * month — so we compute an effective status rather than trusting the raw
 * column blindly. (We also lazily reset the column when we notice this.)
 *
 * Returns null if the stall has no agreement.
 */
async function getRentStatusForStall(stallId) {
  const pool = await poolPromise;
  const result = await pool.request().input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT TOP 1
        AgreementId,
        StallId,
        MonthlyRent,
        RentStatus,
        DueDay,
        LastPaidMonth,
        LastPaidAt,
        StartDate
      FROM dbo.RentalAgreements
      WHERE StallId = @stallId
      ORDER BY CreatedAt DESC
    `);

  const row = result.recordset[0];
  if (!row) return null;

  const currentMonth = serverMonthKey();
  const amount = Number(row.MonthlyRent) || 0;
  const dueDay = Number(row.DueDay) || 1;

  // Effective paid = the last paid month matches the current month.
  const paidThisMonth =
    row.LastPaidMonth === currentMonth && row.RentStatus === "paid";

  // Lazy rollover: if the column says 'paid' but it was for a past month,
  // flip it back to 'unpaid' so downstream reads are consistent.
  if (!paidThisMonth && row.RentStatus === "paid") {
    await pool.request().input("agreementId", sql.NVarChar, row.AgreementId)
      .query(`
        UPDATE dbo.RentalAgreements
        SET RentStatus = 'unpaid', UpdatedAt = GETDATE()
        WHERE AgreementId = @agreementId
      `);
  }

  // Due date for the current month.
  const [y, m] = currentMonth.split("-").map(Number);
  const dueDate = new Date(y, m - 1, dueDay, 23, 59, 59, 999);
  const now = new Date();

  const isPaid = paidThisMonth;
  const isOverdue = !isPaid && now > dueDate;

  // Reminder window: within N days BEFORE the due date (or already past it).
  const REMINDER_DAYS = 7;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilDue = Math.ceil((dueDate - now) / msPerDay);
  const inReminderWindow = !isPaid && daysUntilDue <= REMINDER_DAYS;

  return {
    agreementId: row.AgreementId,
    stallId: row.StallId,
    amount,
    dueDay,
    month: currentMonth,
    dueDate,
    status: isPaid ? "paid" : "unpaid",
    isPaid,
    isOverdue,
    daysUntilDue,
    inReminderWindow,
    lastPaidMonth: row.LastPaidMonth || null,
    lastPaidAt: row.LastPaidAt || null,
  };
}

async function markRentPaid(stallId, month) {
  const pool = await poolPromise;
  const status = await getRentStatusForStall(stallId);
  if (!status) return { updated: false, month: null, amount: 0 };

  const targetMonth = month || status.month;

  if (status.isPaid && targetMonth === status.month) {
    return { updated: false, month: targetMonth, amount: status.amount };
  }

  const result = await pool
    .request()
    .input("agreementId", sql.NVarChar, status.agreementId)
    .input("month", sql.NVarChar, targetMonth).query(`
      UPDATE dbo.RentalAgreements
      SET RentStatus = 'paid',
          LastPaidMonth = @month,
          LastPaidAt = GETDATE(),
          UpdatedAt = GETDATE()
      WHERE AgreementId = @agreementId
        AND (LastPaidMonth IS NULL OR LastPaidMonth <> @month)
    `);

  return {
    updated: result.rowsAffected[0] > 0,
    month: targetMonth,
    amount: status.amount,
  };
}

/**
 * Rental payment history for a stall (from Payments where PayTo = 'rental').
 */
async function getRentalPayments(stallId) {
  const pool = await poolPromise;
  const result = await pool.request().input("stallId", sql.NVarChar, stallId)
    .query(`
      SELECT TOP 24
        PaymentId,
        Amount,
        PaymentMethod,
        PaymentMonth,
        Note,
        CreatedAt
      FROM dbo.Payments
      WHERE StallId = @stallId
        AND PayTo IN ('operator', 'rental')
      ORDER BY CreatedAt DESC
    `);

  return result.recordset;
}

module.exports = {
  getStallForOwner,
  getAgreementByStallId,
  getOperatorBill,
  ensureOperatorBill,
  markOperatorBillPaid,
  getBillStatusForStall,
  addPayment,
  getPaymentsForMonth,
  getOperatorPaidLifetime,
  // rental agreement / paywall
  getRentStatusForStall,
  markRentPaid,
  getRentalPayments,
};
