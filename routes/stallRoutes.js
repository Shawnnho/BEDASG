const express = require("express");
const router = express.Router();
const stallController = require("../controllers/stallController");

// GET /api/stalls  -> list all active stalls
router.get("/", stallController.getAllStalls);
router.get("/:id", stallController.getStallById);

module.exports = router;