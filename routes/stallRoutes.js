const express = require("express");
const router = express.Router();
const stallController = require("../controllers/stallController");

// GET /api/stalls  -> list all active stalls
router.get("/", stallController.getAllStalls
    // #swagger.tags = ['Stalls (Customer)']
    // #swagger.summary = 'List all active stalls'
);
router.get("/:id", stallController.getStallById
    // #swagger.tags = ['Stalls (Customer)']
    // #swagger.summary = 'Get a stall by ID'
);
router.get("/:id/hours",stallController.getStallHours
    // #swagger.tags = ['Stalls (Customer)']
    // #swagger.summary = 'Get a stall operating hours by ID'
);

module.exports = router;