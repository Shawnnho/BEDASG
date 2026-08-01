const express = require("express");
const router = express.Router();
const custController = require("../controllers/custController");
const authenticate = require("../middlewares/auth").verifyToken;

router.get("/:id", authenticate, custController.getCustomer
    // #swagger.tags = ['Customer']
    // #swagger.summary = 'Get customer profile by ID'
);
router.put("/:id", authenticate, custController.updateProfile
    // #swagger.tags = ['Customer']
    // #swagger.summary = 'Update customer profile'
);
router.patch("/:id/password", authenticate, custController.changePassword
    // #swagger.tags = ['Customer']
    // #swagger.summary = 'Update customer password'
);

module.exports = router;