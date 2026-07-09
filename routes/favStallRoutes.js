const express = require("express");
const router = express.Router();
const favStallController = require("../controllers/favStallController");

router.post("/add", favStallController.addFavStall);
router.delete("/delete", favStallController.deleteFavStall);

module.exports = router;
