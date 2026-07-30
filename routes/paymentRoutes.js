const express = require("express");
const router = express.Router();

const { verifyToken, requireRole } = require("../middlewares/auth");
const paymentController = require("../controllers/paymentController");

// All payment routes require a logged-in storeholder.
router.use(verifyToken, requireRole("storeholder"));

router.get("/summary", (req, res) => {
  // #swagger.tags = ['Manage Payments']
  // #swagger.summary = 'Payment summary: bill, payments this month, amount due, lifetime paid'
  paymentController.getSummary(req, res);
});
router.post("/operator/pay", (req, res) => {
  // #swagger.tags = ['Manage Payments']
  // #swagger.summary = 'Pay the operator bill for a given month (simulated)'
  paymentController.payOperator(req, res);
});
router.post("/staff/pay", (req, res) => {
  // #swagger.tags = ['Manage Payments']
  // #swagger.summary = 'Pay staff payroll (not yet implemented — returns 501)'
  paymentController.payStaff(req, res);
});

module.exports = router;
