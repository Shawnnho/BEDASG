// ============================================================
// controllers/stallClosureController.js
//
// Stallholder-facing feature: view upcoming Singapore public holidays
// (pulled server-side from data.gov.sg) and manage the dates on which
// this stall will be closed. Full CRUD against dbo.StallClosures.
//
// Auth: routes are gated by verifyToken + requireRole("storeholder").
// The owning stall is resolved from the JWT the same way stallMenu
// Controller does it (req.user -> getUserInfo -> StallId), so a
// stallholder can only ever see/modify their own stall's closures.
// ============================================================

const Joi = require("joi");
const closureModel = require("../models/stallClosureModel");
const orderModel = require("../models/orderModel"); // reuse getUserInfo
const { fetchUpcomingHolidays } = require("../services/holidayService");

// Resolve the logged-in owner's stall from the JWT cookie.
// Mirrors the resolveStall helper used elsewhere in the stall dashboard.
async function resolveStall(req, res) {
  const userId = req.user?.UserId || req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const user = await orderModel.getUserInfo(userId);
  if (!user?.StallId) {
    res.status(404).json({ error: "No stall linked to this user" });
    return null;
  }
  return user; // { StallId, Name }
}

// Validation for create/update. A closure needs a valid ISO date and an
// optional short reason. `.iso` keeps it to yyyy-mm-dd style values.
const closureSchema = Joi.object({
  closureDate: Joi.date().iso().required().messages({
    "any.required": "A closure date is required.",
    "date.base": "Please provide a valid date.",
    "date.format": "Date must be in YYYY-MM-DD format.",
  }),
  reason: Joi.string().trim().max(255).allow("", null).messages({
    "string.max": "Reason must be 255 characters or fewer.",
  }),
});

// GET /api/stall/closures/holidays
// Returns upcoming SG public holidays (server-side third-party API call).
async function getHolidays(req, res) {
  try {
    const holidays = await fetchUpcomingHolidays();
    res.json(holidays);
  } catch (err) {
    console.error("getHolidays error:", err.message);
    // 502: the failure is an upstream (data.gov.sg) problem, not the client's.
    res.status(502).json({
      error:
        "Could not load public holiday data right now. Please try again later.",
    });
  }
}

// GET /api/stall/closures
// All closures for the logged-in stallholder's stall.
async function getClosures(req, res) {
  try {
    const stall = await resolveStall(req, res);
    if (!stall) return;

    const rows = await closureModel.getClosuresByStall(stall.StallId);
    res.json(rows);
  } catch (err) {
    console.error("getClosures error:", err.message);
    res.status(500).json({ error: "Failed to retrieve stall closures." });
  }
}

// POST /api/stall/closures
// Create a closure for a given date.
async function createClosure(req, res) {
  try {
    const stall = await resolveStall(req, res);
    if (!stall) return;

    const { error, value } = closureSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const closureId = await closureModel.addClosure(
      stall.StallId,
      value.closureDate,
      value.reason,
    );
    res.status(201).json({ message: "Closure added.", closureId });
  } catch (err) {
    // Unique constraint (StallId, ClosureDate) -> already closed that day.
    if (err.number === 2627 || err.number === 2601) {
      return res
        .status(409)
        .json({ error: "This stall is already marked closed on that date." });
    }
    console.error("createClosure error:", err.message);
    res.status(500).json({ error: "Failed to add closure." });
  }
}

// PUT /api/stall/closures/:closureId
// Update the date and/or reason of an existing closure.
async function updateClosure(req, res) {
  try {
    const stall = await resolveStall(req, res);
    if (!stall) return;

    const closureId = Number(req.params.closureId);
    if (!Number.isInteger(closureId) || closureId <= 0) {
      return res.status(400).json({ error: "Invalid closure id." });
    }

    const { error, value } = closureSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const affected = await closureModel.updateClosure(
      closureId,
      stall.StallId,
      value.closureDate,
      value.reason,
    );
    if (affected === 0) {
      return res.status(404).json({ error: "Closure not found." });
    }
    res.json({ message: "Closure updated." });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res
        .status(409)
        .json({ error: "This stall is already marked closed on that date." });
    }
    console.error("updateClosure error:", err.message);
    res.status(500).json({ error: "Failed to update closure." });
  }
}

// DELETE /api/stall/closures/:closureId
// Remove a closure (reopen the stall for that date).
async function deleteClosure(req, res) {
  try {
    const stall = await resolveStall(req, res);
    if (!stall) return;

    const closureId = Number(req.params.closureId);
    if (!Number.isInteger(closureId) || closureId <= 0) {
      return res.status(400).json({ error: "Invalid closure id." });
    }

    const affected = await closureModel.deleteClosure(closureId, stall.StallId);
    if (affected === 0) {
      return res.status(404).json({ error: "Closure not found." });
    }
    res.json({ message: "Closure removed." });
  } catch (err) {
    console.error("deleteClosure error:", err.message);
    res.status(500).json({ error: "Failed to remove closure." });
  }
}

module.exports = {
  getHolidays,
  getClosures,
  createClosure,
  updateClosure,
  deleteClosure,
};
