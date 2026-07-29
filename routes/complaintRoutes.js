const express = require("express");
const router = express.Router();

const complaintController = require("../controllers/complaintController");
const { verifyToken } = require("../middlewares/auth");
const { 
    requireComplaintExists, requireComplaintOwnership,
} = require("../middlewares/feedbackAuth");
const {
  validateCreateComplaint, validateUpdateComplaint, validateComplaintIdParam,
} = require("../middlewares/feedbackValidation");

router.use(express.json({ limit: "8mb" }));

router.post("/", verifyToken, validateCreateComplaint, complaintController.createComplaint);
router.get("/mine", verifyToken, complaintController.getMyComplaints);
router.put( "/:complaintId", verifyToken, validateComplaintIdParam, validateUpdateComplaint, requireComplaintExists, requireComplaintOwnership,
  complaintController.updateComplaint,
);
router.delete( "/:complaintId", verifyToken, validateComplaintIdParam, requireComplaintExists, requireComplaintOwnership, 
    complaintController.deleteComplaint,
);

module.exports = router;