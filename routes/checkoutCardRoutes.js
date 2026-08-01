const express = require("express");
const router = express.Router();
const checkoutCardController = require("../controllers/checkoutCardController");
const { optionalAuth, guestSession } = require("../middlewares/auth");

// Guest checkout is a supported flow, so these can't require login — but
// when the caller IS logged in, the controller checks the checkout's owner
// against req.user so one account can't view/pay another's order.
router.use(optionalAuth);

router.post("/create", guestSession, checkoutCardController.createCheckout
    // #swagger.tags = ['Checkout (Customer)']
    // #swagger.summary = 'Create a new checkout session'
);
router.get("/:checkoutId", checkoutCardController.getCheckout
    // #swagger.tags = ['Checkout (Customer)']
    // #swagger.summary = 'Get checkout details by id'
);
router.get("/:checkoutId/qr", checkoutCardController.getCheckoutQr
    // #swagger.tags = ['Checkout (Customer)']
    // #swagger.summary = 'Get a QR code for the checkout'
);
router.post("/:checkoutId/pay", checkoutCardController.payCheckout
    // #swagger.tags = ['Checkout (Customer)']
    // #swagger.summary = 'Pay for a checkout'
);

module.exports = router;