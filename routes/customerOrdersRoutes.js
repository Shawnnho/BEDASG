const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");
const customerOrdersController = require("../controllers/customerOrdersController");

router.get("/", verifyToken, customerOrdersController.getMyOrders);
router.delete("/:id", verifyToken, customerOrdersController.deleteMyOrder);
router.patch("/:id/cancel", verifyToken, customerOrdersController.cancelMyOrder);

module.exports = router;