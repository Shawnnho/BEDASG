const express = require("express");
const router = express.Router();

const { verifyToken, requireRole } = require("../middlewares/auth");
const paymentController = require("../controllers/paymentController");

// All payment routes require a logged-in storeholder.
router.use(verifyToken, requireRole("storeholder"));

router.get("/summary", paymentController.getSummary);
router.post("/operator/pay", paymentController.payOperator);
router.post("/staff/pay", paymentController.payStaff);

module.exports = router;
