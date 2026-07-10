const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");
const orderController = require("../controllers/orderController");

// All routes below require a valid JWT
router.get("/dashboard", verifyToken, orderController.getDashboard);
router.patch("/orders/status", verifyToken, orderController.bulkUpdateStatus);

// stall-orders page
router.get("/orders", verifyToken, orderController.getStallOrders);
router.patch("/orders/confirm-cash", verifyToken, orderController.confirmCash);
router.patch("/orders/complete", verifyToken, orderController.completeOrder);

module.exports = router;
