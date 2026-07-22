const paymentModel = require("../models/paymentModel");

/**
 * Payment seam. For this school project we simulate the gateway: it always
 * "succeeds". To go live later, replace the body with a real Stripe/PayNow
 * call and return { success, reference } based on the gateway response —
 * nothing else in the app needs to change.
 */
async function processPayment({ amount, method }) {
  return {
    success: true,
    reference: `SIM-${Date.now().toString(36).toUpperCase()}`,
  };
}

function fmtMonthLabel(monthKey) {
  if (!monthKey) return "";
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString("en-SG", { month: "long", year: "numeric" });
}

function isValidMonth(month) {
  return typeof month === "string" && /^\d{4}-\d{2}$/.test(month);
}

/**
 * GET /api/rental/status
 * Returns the authenticated stall's monthly BILL status + whether the
 * login popup should show. (One bill = rent + utilities + cleaning + etc.)
 */
async function getStatus(req, res) {
  try {
    const stall = await paymentModel.getStallForOwner(req.user.userId);
    if (!stall) {
      return res.status(404).json({ error: "No stall found for this user." });
    }

    const status = await paymentModel.getBillStatusForStall(
      stall.StallId,
      stall.CentreId,
    );
    if (!status) {
      return res.json({
        hasBill: false,
        showPopup: false,
        isPaid: true,
        isOverdue: false,
      });
    }

    return res.json({
      hasBill: true,
      stallName: stall.StallName,
      amount: status.total,
      month: status.month,
      monthLabel: fmtMonthLabel(status.month),
      dueDate: status.dueDate,
      status: status.status,
      isPaid: status.isPaid,
      isOverdue: status.isOverdue,
      daysUntilDue: status.daysUntilDue,
      showPopup: status.inReminderWindow || status.isOverdue,
    });
  } catch (err) {
    console.error("bill getStatus failed:", err);
    return res.status(500).json({ error: "Failed to load bill status." });
  }
}

/**
 * POST /api/rental/pay
 * body: { method, note }
 * Pays the current month's BILL in full: simulated gateway → mark bill paid
 * → log a Payment. Lifts the paywall.
 */
async function payRent(req, res) {
  try {
    const stall = await paymentModel.getStallForOwner(req.user.userId);
    if (!stall) {
      return res.status(404).json({ error: "No stall found for this user." });
    }

    const reqMonth = isValidMonth(req.body.month) ? req.body.month : undefined;

    const status = await paymentModel.getBillStatusForStall(
      stall.StallId,
      stall.CentreId,
      reqMonth,
    );

    if (!status) {
      return res.status(404).json({ error: "No bill found." });
    }
    if (status.isPaid) {
      return res
        .status(409)
        .json({ error: "This month's bill is already paid." });
    }

    const method = (req.body.method || "paynow").trim();
    const note = (req.body.note || "").trim();

    const gateway = await processPayment({ amount: status.total, method });
    if (!gateway.success) {
      return res.status(402).json({ error: "Payment was declined." });
    }

    const updated = await paymentModel.markOperatorBillPaid(
      stall.StallId,
      status.month,
    );
    if (!updated) {
      return res
        .status(409)
        .json({ error: "Could not update bill (already paid?)." });
    }

    await paymentModel.markRentPaid(stall.StallId, status.month);

    await paymentModel.addPayment({
      stallId: stall.StallId,
      amount: status.total,
      method,
      month: status.month,
      payTo: "operator",
      note:
        note ||
        `Bill ${fmtMonthLabel(status.month)} · ref ${gateway.reference}`,
      createdBy: req.user.userId,
    });

    return res.json({
      ok: true,
      month: status.month,
      amount: status.total,
      reference: gateway.reference,
    });
  } catch (err) {
    console.error("bill payRent failed:", err);
    return res.status(500).json({ error: "Failed to process bill payment." });
  }
}

/**
 * GET /api/rental/notifications
 * Bill status + recent bill payment history for the notifications card.
 */
async function getNotifications(req, res) {
  try {
    const stall = await paymentModel.getStallForOwner(req.user.userId);
    if (!stall) {
      return res.status(404).json({ error: "No stall found for this user." });
    }

    const status = await paymentModel.getBillStatusForStall(
      stall.StallId,
      stall.CentreId,
    );

    // Payment history: bill payments to the operator.
    const historyRows = await paymentModel.getRentalPayments(stall.StallId);
    const history = historyRows.map((r) => ({
      paymentId: r.PaymentId,
      amount: Number(r.Amount) || 0,
      method: r.PaymentMethod || "",
      month: r.PaymentMonth || "",
      monthLabel: fmtMonthLabel(r.PaymentMonth),
      note: r.Note || "",
      createdAt: r.CreatedAt || null,
    }));

    const notifications = [];
    if (status && !status.isPaid) {
      notifications.push({
        type: "bill_due",
        severity: status.isOverdue ? "overdue" : "due",
        title: status.isOverdue
          ? "Monthly bill overdue"
          : "Monthly bill due soon",
        message: status.isOverdue
          ? `Your bill of $${status.total.toFixed(2)} for ${fmtMonthLabel(status.month)} is overdue. Stall management is locked until paid.`
          : `Your bill of $${status.total.toFixed(2)} for ${fmtMonthLabel(status.month)} is due on ${new Date(status.dueDate).toLocaleDateString("en-SG")}.`,
        amount: status.total,
        dueDate: status.dueDate,
        status: "unpaid",
      });
    }

    return res.json({
      hasBill: !!status,
      currentStatus: status
        ? {
            amount: status.total,
            month: status.month,
            monthLabel: fmtMonthLabel(status.month),
            status: status.status,
            isOverdue: status.isOverdue,
            dueDate: status.dueDate,
          }
        : null,
      notifications,
      history,
    });
  } catch (err) {
    console.error("bill getNotifications failed:", err);
    return res.status(500).json({ error: "Failed to load notifications." });
  }
}

module.exports = { getStatus, payRent, getNotifications };
