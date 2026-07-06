const express = require("express");
const router = express.Router();
const centreController = require("../controllers/centreController");

router.get("/", centreController.getCentres);
router.get("/:id", centreController.getCentre);

module.exports = router;
