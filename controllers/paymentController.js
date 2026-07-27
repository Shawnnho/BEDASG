const paymentModel = require("../models/paymentModel");

// yyyy-mm for the current month
function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Basic guard so a caller can't pass junk like "2025-13" or SQL text.
function isValidMonth(month) {
  return typeof month === "string" && /^\d{4}-\d{2}$/.test(month);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Shape an OperatorBills row into the flat JSON the frontend expects.
function shapeBill(row) {
  if (!row) {
    return {
      billId: null,
      month: null,
      rent: 0,
      utilities: 0,
      cleaningFee: 0,
      penalty: 0,
      other: 0,
      total: 0,
      dueDate: null,
      status: "none",
      isPaid: true,
      paidAt: null,
    };
  }

  const rent = num(row.RentAmount);
  const utilities = num(row.Utilities);
  const cleaningFee = num(row.CleaningFee);
  const penalty = num(row.Penalty);
  const other = num(row.OtherCharges);
  const total =
    num(row.TotalAmount) || rent + utilities + cleaningFee + penalty + other;

  return {
    billId: row.BillId,
    month: row.BillMonth,
    rent,
    utilities,
    cleaningFee,
    penalty,
    other,
    total,
    dueDate: row.DueDate || null,
    status: row.BillStatus || (row.IsPaid ? "paid" : "unpaid"),
    isPaid: !!row.IsPaid,
    paidAt: row.PaidAt || null,
  };
}

function shapePayment(row) {
  return {
    paymentId: row.PaymentId,
    amount: num(row.Amount),
    method: row.PaymentMethod || "",
    month: row.PaymentMonth || "",
    payTo: row.PayTo || "",
    note: row.Note || "",
    createdAt: row.CreatedAt || null,
  };
}

/**
 * GET /api/payments/summary?month=yyyy-mm
 * Returns the full payment summary for the logged-in storeholder's stall.
 */
async function getSummary(req, res) {
  try {
    const stall = await paymentModel.getStallForOwner(req.user.userId);
    if (!stall) {
      return res.status(404).json({ error: "No stall found for this user." });
    }

    const month = isValidMonth(req.query.month)
      ? req.query.month
      : currentMonthKey();

    const billRow = await paymentModel.ensureOperatorBill(
      stall.StallId,
      stall.CentreId,
      month,
    );
    const bill = shapeBill(billRow);

    const paymentRows = await paymentModel.getPaymentsForMonth(
      stall.StallId,
      month,
    );
    const payments = paymentRows.map(shapePayment);
    const paidThisMonth = payments.reduce((sum, p) => sum + p.amount, 0);

    const operatorPaidLifetime = await paymentModel.getOperatorPaidLifetime(
      stall.StallId,
    );

    // Staff payroll: StaffTimesheets table not built yet — stub empty for now.
    const staff = {
      totalHours: 0,
      totalPay: 0,
      status: "Unpaid",
      rows: [],
    };

    const operatorDue = bill.isPaid ? 0 : bill.total;
    const staffDue = staff.totalPay;
    const grandDue = operatorDue + staffDue;

    return res.json({
      stall: {
        stallId: stall.StallId,
        stallName: stall.StallName,
        ownerName: stall.OwnerName || "",
      },
      month,
      bill,
      staff,
      payments,
      totals: {
        operatorDue,
        staffDue,
        grandDue,
        paidThisMonth,
        operatorPaidLifetime,
      },
    });
  } catch (err) {
    console.error("getSummary failed:", err);
    return res.status(500).json({ error: "Failed to load payment summary." });
  }
}

/**
 * POST /api/payments/operator/pay
 * body: { month, method, note }
 * Marks the operator bill paid for the month and logs a payment.
 */
async function payOperator(req, res) {
  try {
    const stall = await paymentModel.getStallForOwner(req.user.userId);
    if (!stall) {
      return res.status(404).json({ error: "No stall found for this user." });
    }

    const month = isValidMonth(req.body.month)
      ? req.body.month
      : currentMonthKey();
    const method = (req.body.method || "paynow").trim();
    const note = (req.body.note || "").trim();

    const billRow = await paymentModel.ensureOperatorBill(
      stall.StallId,
      stall.CentreId,
      month,
    );

    if (!billRow) {
      return res
        .status(404)
        .json({ error: "No bill exists yet for this stall — there's nothing to pay." });
    }

    const bill = shapeBill(billRow);

    if (bill.isPaid) {
      return res
        .status(409)
        .json({ error: "Operator bill is already paid for this month." });
    }

    const updated = await paymentModel.markOperatorBillPaid(
      stall.StallId,
      month,
    );
    if (!updated) {
      return res
        .status(409)
        .json({ error: "Bill could not be updated (already paid?)." });
    }

    await paymentModel.markRentPaid(stall.StallId, month);

    await paymentModel.addPayment({
      stallId: stall.StallId,
      amount: bill.total,
      method,
      month,
      payTo: "operator",
      note,
      createdBy: req.user.userId,
    });

    return res.json({ ok: true, month, amount: bill.total });
  } catch (err) {
    console.error("payOperator failed:", err);
    return res
      .status(500)
      .json({ error: "Failed to record operator payment." });
  }
}

/**
 * POST /api/payments/staff/pay
 * Staff payroll not implemented yet (StaffTimesheets table pending).
 */
async function payStaff(req, res) {
  return res.status(501).json({ error: "Staff payroll is not available yet." });
}

module.exports = { getSummary, payOperator, payStaff };