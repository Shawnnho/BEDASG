// ============================================================
// routes/stallClosureRoutes.js
//
// Stallholder-facing routes for the Stall Closures feature.
//
// Every route below requires:
//   1. a valid JWT cookie          (verifyToken)
//   2. the "storeholder" role      (requireRole)
// so customers and NEA officers cannot reach these endpoints even if
// they know the URL. This is the authorization layer for the feature.
//
// Mounted in app.js as:  app.use("/api/stall/closures", stallClosureRoutes);
// ============================================================

const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middlewares/auth");
const controller = require("../controllers/stallClosureController");

// Applies to every route below.
router.use(verifyToken, requireRole("storeholder"));

// Upcoming SG public holidays (server-side data.gov.sg call).
router.get("/holidays", (req, res) => {
  // #swagger.tags = ['Stall Closures']
  // #swagger.summary = 'Fetch Singapore public holidays (data.gov.sg) as closure suggestions'
  controller.getHolidays(req, res);
});

// CRUD for this stall's closures.
router.get("/", (req, res) => {
  // #swagger.tags = ['Stall Closures']
  // #swagger.summary = "List the stall's scheduled closures"
  controller.getClosures(req, res);
});
router.post("/", (req, res) => {
  // #swagger.tags = ['Stall Closures']
  // #swagger.summary = 'Create a stall closure'
  controller.createClosure(req, res);
});
router.put("/:closureId", (req, res) => {
  // #swagger.tags = ['Stall Closures']
  // #swagger.summary = 'Edit a stall closure'
  controller.updateClosure(req, res);
});
router.delete("/:closureId", (req, res) => {
  // #swagger.tags = ['Stall Closures']
  // #swagger.summary = 'Delete a stall closure'
  controller.deleteClosure(req, res);
});

module.exports = router;
