const express = require("express");
const router = express.Router();
const custController = require("../controllers/custController");
const authenticate = require("../middlewares/auth").verifyToken;

router.get("/:id", authenticate, custController.getCustomer);
router.put("/:id", authenticate, custController.updateProfile);

module.exports = router;