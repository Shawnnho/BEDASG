const express = require("express");
const router = express.Router();
const centreController = require("../controllers/centreController");

router.get("/", centreController.getCentres
    // #swagger.tags = ['Centre (Customer)']
    // #swagger.summary = 'List all centres'
);
router.get("/:id", centreController.getCentre
    // #swagger.tags = ['Centre (Customer)']
    // #swagger.summary = 'Get a centre by ID'
);

module.exports = router;
