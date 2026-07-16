const express = require("express");
const router = express.Router();

const complaintController = require("../controllers/complaintController");
const { verifyToken } = require("../middlewares/auth");

router.use(express.json({ limit: "8mb" }));

router.post("/", verifyToken, complaintController.createComplaint);
router.get("/mine", verifyToken, complaintController.getMyComplaints);
router.put("/:complaintId", verifyToken, complaintController.updateComplaint);
router.delete("/:complaintId", verifyToken, complaintController.deleteComplaint);

module.exports = router;

