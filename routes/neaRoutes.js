const express = require("express");
const router = express.Router();
const neaController = require("../controllers/neaController");
const { verifyToken, requireRole } = require("../middlewares/auth");

// Every route below requires a valid session AND the nea_officer role —
// applied once here rather than repeated on each line.
router.use(verifyToken, requireRole("nea_officer"));

router.get("/stalls", neaController.listStalls);
// #swagger.tags = ['Hygiene Grade']
// #swagger.summary = 'NEA: list all stalls for grade management'

router.get("/grades/overview", neaController.getGradeOverview);
// #swagger.tags = ['Hygiene Grade']
// #swagger.summary = 'NEA: grade distribution overview across all stalls'

router.put("/stalls/:stallId/grade", neaController.updateStallGrade);
// #swagger.tags = ['Hygiene Grade']
// #swagger.summary = "NEA: manually update a stall's hygiene grade"

router.get("/inspections", neaController.listInspections);
// #swagger.tags = ['Hygiene Inspections']
// #swagger.summary = 'NEA: list scheduled and completed inspections'

router.post("/inspections", neaController.scheduleInspection);
// #swagger.tags = ['Hygiene Inspections']
// #swagger.summary = 'NEA: schedule a new inspection for a stall'

router.put("/inspections/:inspectionId/cancel", neaController.cancelInspection);
// #swagger.tags = ['Hygiene Inspections']
// #swagger.summary = 'NEA: cancel a scheduled inspection'

router.put("/inspections/:inspectionId/complete", neaController.completeInspection);
// #swagger.tags = ['Hygiene Inspections']
// #swagger.summary = 'NEA: submit inspection results and assign a grade'

router.delete("/inspections/:inspectionId", neaController.deleteInspection);
// #swagger.tags = ['Hygiene Inspections']
// #swagger.summary = 'NEA: delete an inspection record'

router.get("/complaints", neaController.listComplaints);
// #swagger.tags = ['Manage Complaints']
// #swagger.summary = 'NEA: list complaints submitted against stalls'

router.put("/complaints/:complaintId/status", neaController.updateComplaintStatus);
// #swagger.tags = ['Manage Complaints']
// #swagger.summary = "NEA: update a complaint's review status"

module.exports = router;