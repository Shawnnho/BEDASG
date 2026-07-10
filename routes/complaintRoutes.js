const express = require("express");
const router = express.Router();

const complaintController = require("../controllers/complaintController");
const { verifyToken } = require("../middlewares/auth");

router.post("/", verifyToken, complaintController.createComplaint);
router.get("/mine", verifyToken, complaintController.getMyComplaints);

module.exports = router;

