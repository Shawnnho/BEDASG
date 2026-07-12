const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");
const customerOrdersController = require("../controllers/customerOrdersController");

router.get("/", verifyToken, customerOrdersController.getMyOrders);

module.exports = router;