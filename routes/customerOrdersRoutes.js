const express = require("express");
const router = express.Router();
const {
  verifyToken,
  optionalAuth,
  guestSession,
} = require("../middlewares/auth");
const customerOrdersController = require("../controllers/customerOrdersController");

// Guest order history — session-scoped, no login. optionalAuth detects a
// logged-in caller (so the handler can redirect them), guestSession supplies
// req.guestSessionId. Must be declared before "/" so it isn't shadowed.
router.get(
  "/guest",
  optionalAuth,
  guestSession,
  customerOrdersController.getGuestOrders,
  // #swagger.tags = ['Order History (Customer)']
  // #swagger.summary = 'Get guest order history via session id'
);

router.get(
  "/",
  verifyToken,
  customerOrdersController.getMyOrders,
  // #swagger.tags = ['Order History (Customer)']
  // #swagger.summary = "Get the logged-in customer's order history"
);
router.delete(
  "/:id",
  verifyToken,
  customerOrdersController.deleteMyOrder,
  // #swagger.tags = ['Order History (Customer)']
  // #swagger.summary = "Delete one of the logged-in customer's orders"
);
router.patch(
  "/:id/cancel",
  verifyToken,
  customerOrdersController.cancelMyOrder,
  // #swagger.tags = ['Order History (Customer)']
  // #swagger.summary = "Cancel one of the logged-in customer's orders"
);

module.exports = router;