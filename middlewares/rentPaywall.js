const paymentModel = require("../models/paymentModel");

/**
 * Paywall middleware.
 *
 * Place AFTER verifyToken on protected stall-management API routes. If the
 * authenticated stall's rent is overdue (past the due date and unpaid), the
 * request is blocked with 402 Payment Required. The frontend detects this
 * and redirects into the rental payment flow.
 *
 * Only overdue blocks — being merely "due soon" (within the reminder window)
 * does NOT lock the owner out; that just triggers the popup. This matches the
 * story: paywall applies once the due date has PASSED unpaid.
 *
 * IMPORTANT: do not apply this to the rental status/pay routes themselves, or
 * the owner could never reach the screen that lets them pay.
 */
function enforceRentPaywall(options = {}) {
  // Fail-open by default: if the status check errors, let the request through
  // rather than locking a paying user out due to a transient DB blip.
  const failOpen = options.failOpen !== false;

  return async function (req, res, next) {
    try {
      if (!req.user || !req.user.userId) {
        // No user on request — let downstream auth handle it.
        return next();
      }

      const stall = await paymentModel.getStallForOwner(req.user.userId);
      if (!stall) return next(); // not a storeholder / no stall → nothing to gate

      const status = await paymentModel.getBillStatusForStall(
        stall.StallId,
        stall.CentreId,
      );
      if (!status) return next(); // no bill → nothing to gate

      if (status.isOverdue) {
        return res.status(402).json({
          error: "bill_overdue",
          message:
            "Your monthly bill is overdue. Please pay to regain access to stall management.",
          amount: status.total,
          month: status.month,
          dueDate: status.dueDate,
          payUrl: "/rental-payment.html",
        });
      }

      return next();
    } catch (err) {
      console.error("rentPaywall check failed:", err);
      if (failOpen) return next();
      return res.status(500).json({ error: "Paywall check failed." });
    }
  };
}

module.exports = { enforceRentPaywall };
