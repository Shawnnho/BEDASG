const express = require("express");
const router = express.Router();
const neaController = require("../controllers/neaController");
const { verifyToken, requireRole } = require("../middlewares/auth");

// Every route below requires a valid session AND the nea_officer role —
// applied once here rather than repeated on each line.
router.use(verifyToken, requireRole("nea_officer"));

router.get("/stalls", neaController.listStalls);
router.get("/grades/overview", neaController.getGradeOverview);
router.put("/stalls/:stallId/grade", neaController.updateStallGrade);

router.get("/inspections", neaController.listInspections);
router.post("/inspections", neaController.scheduleInspection);
router.put("/inspections/:inspectionId/cancel", neaController.cancelInspection);
router.put("/inspections/:inspectionId/complete", neaController.completeInspection);

router.get("/complaints", neaController.listComplaints);
router.put("/complaints/:complaintId/status", neaController.updateComplaintStatus);

module.exports = router;
