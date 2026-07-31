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
);

router.get("/", verifyToken, customerOrdersController.getMyOrders);
router.delete("/:id", verifyToken, customerOrdersController.deleteMyOrder);
router.patch(
  "/:id/cancel",
  verifyToken,
  customerOrdersController.cancelMyOrder,
);

module.exports = router;
