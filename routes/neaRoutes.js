const express = require("express");
const router = express.Router();
const neaController = require("../controllers/neaController");
const { verifyToken, requireRole } = require("../middlewares/auth");

router.use(verifyToken, requireRole("nea_officer"));

router.get("/stalls", (req, res) => {
  // #swagger.tags = ['Hygiene Grade']
  // #swagger.summary = 'NEA: list all stalls for grade management'
  neaController.listStalls(req, res);
});

router.get("/grades/overview", (req, res) => {
  // #swagger.tags = ['Hygiene Grade']
  // #swagger.summary = 'NEA: grade distribution overview across all stalls'
  neaController.getGradeOverview(req, res);
});

router.put("/stalls/:stallId/grade", (req, res) => {
  // #swagger.tags = ['Hygiene Grade']
  // #swagger.summary = "NEA: manually update a stall's hygiene grade"
  neaController.updateStallGrade(req, res);
});

router.get("/inspections", (req, res) => {
  // #swagger.tags = ['Hygiene Inspections']
  // #swagger.summary = 'NEA: list scheduled and completed inspections'
  neaController.listInspections(req, res);
});

router.post("/inspections", (req, res) => {
  // #swagger.tags = ['Hygiene Inspections']
  // #swagger.summary = 'NEA: schedule a new inspection for a stall'
  neaController.scheduleInspection(req, res);
});

router.put("/inspections/:inspectionId/cancel", (req, res) => {
  // #swagger.tags = ['Hygiene Inspections']
  // #swagger.summary = 'NEA: cancel a scheduled inspection'
  neaController.cancelInspection(req, res);
});

router.put("/inspections/:inspectionId/complete", (req, res) => {
  // #swagger.tags = ['Hygiene Inspections']
  // #swagger.summary = 'NEA: submit inspection results and assign a grade'
  neaController.completeInspection(req, res);
});

router.delete("/inspections/:inspectionId", (req, res) => {
  // #swagger.tags = ['Hygiene Inspections']
  // #swagger.summary = 'NEA: delete an inspection record'
  neaController.deleteInspection(req, res);
});

router.get("/complaints", (req, res) => {
  // #swagger.tags = ['Manage Complaints']
  // #swagger.summary = 'NEA: list complaints submitted against stalls'
  neaController.listComplaints(req, res);
});

router.put("/complaints/:complaintId/status", (req, res) => {
  // #swagger.tags = ['Manage Complaints']
  // #swagger.summary = "NEA: update a complaint's review status"
  neaController.updateComplaintStatus(req, res);
});

module.exports = router;