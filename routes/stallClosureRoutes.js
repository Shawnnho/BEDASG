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
router.get("/holidays", controller.getHolidays);

// CRUD for this stall's closures.
router.get("/", controller.getClosures); // Read all
router.post("/", controller.createClosure); // Create
router.put("/:closureId", controller.updateClosure); // Update
router.delete("/:closureId", controller.deleteClosure); // Delete

module.exports = router;
