const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");
const { enforceRentPaywall } = require("../middlewares/rentPaywall");
const orderController = require("../controllers/orderController");

router.use(verifyToken, enforceRentPaywall()); // ADD

// All routes below require a valid JWT
router.get("/dashboard", verifyToken, (req, res) => {
  // #swagger.tags = ['Stall Dashboard']
  // #swagger.summary = "Load dashboard KPIs (today's orders, sales, rating, pending actions)"
  orderController.getDashboard(req, res);
});
router.patch("/orders/status", verifyToken, (req, res) => {
  // #swagger.tags = ['Stall Orders']
  // #swagger.summary = 'Update the status of one or more orders at once (bulk)'
  orderController.bulkUpdateStatus(req, res);
});

// stall-orders page
router.get("/orders", verifyToken, (req, res) => {
  // #swagger.tags = ['Stall Orders']
  // #swagger.summary = "List all orders for the owner's stall"
  orderController.getStallOrders(req, res);
});
router.patch("/orders/confirm-cash", verifyToken, (req, res) => {
  // #swagger.tags = ['Stall Orders']
  // #swagger.summary = 'Confirm a cash order as paid'
  orderController.confirmCash(req, res);
});
router.patch("/orders/complete", verifyToken, (req, res) => {
  // #swagger.tags = ['Stall Orders']
  // #swagger.summary = 'Mark an order as completed'
  orderController.completeOrder(req, res);
});
router.patch("/orders/cancel", verifyToken, (req, res) => {
  // #swagger.tags = ['Stall Orders']
  // #swagger.summary = 'Cancel an order'
  orderController.cancelOrder(req, res);
});
router.patch("/orders/refund", verifyToken, (req, res) => {
  // #swagger.tags = ['Stall Orders']
  // #swagger.summary = 'Mark a paid/cancelled order as refunded'
  orderController.markRefunded(req, res);
});

module.exports = router;
