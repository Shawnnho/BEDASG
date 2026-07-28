const neaModel = require("../models/neaModel");

function calculateGradeFromScore(score) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

function parseBreakdown(json) {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function serializeInspection(row) {
  return {
    id: row.InspectionId,
    stallId: row.StallId,
    stallName: row.StallName,
    officer: row.OfficerName,
    status: row.InspectionStatus,
    grade: row.InspectionGrade,
    score: row.InspectionScore,
    remarks: row.Remarks,
    breakdown: parseBreakdown(row.BreakdownJson),
    date: row.InspectionDate,
    dateTs: row.DateTs,
    createdAt: row.CreatedAt,
    completedAt: row.CompletedAt,
    cancelledAt: row.CancelledAt,
  };
}

/* ========== STALLS / GRADING ========== */

async function listStalls(req, res) {
  try {
    const stalls = await neaModel.getAllActiveStalls();
    res.json(stalls);
  } catch (err) {
    console.error("listStalls error:", err);
    res.status(500).json({ error: "Failed to load stalls" });
  }
}

async function getGradeOverview(req, res) {
  try {
    const stalls = await neaModel.getAllActiveStalls();
    const counts = { total: stalls.length, A: 0, B: 0, C: 0, D: 0, none: 0 };
    stalls.forEach((s) => {
      const g = (s.HygieneGrade || "").toUpperCase();
      if (g === "A") counts.A++;
      else if (g === "B") counts.B++;
      else if (g === "C") counts.C++;
      else if (g === "D") counts.D++;
      else counts.none++;
    });
    res.json(counts);
  } catch (err) {
    console.error("getGradeOverview error:", err);
    res.status(500).json({ error: "Failed to load grade overview" });
  }
}

// Used to let an officer nudge a stall's cached grade without waiting for a
// full inspection (e.g. correcting a data-entry mistake). It USED to accept
// an arbitrary { grade } directly from the client — that let a stall's
// grade drift completely out of sync with its actual inspection scores
// (e.g. a stall showing "B" when its latest completed inspection scored 86,
// which is really an "A"; or a stall showing a grade despite having no
// completed inspections at all). Now it takes a { score } and derives the
// grade the exact same way completeInspection does, so there is only ever
// one rule for "what grade is this stall" anywhere in the app.
async function updateStallGrade(req, res) {
  try {
    const { stallId } = req.params;
    const { score } = req.body;

    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) {
      return res.status(400).json({ error: "score must be a number between 0 and 100" });
    }

    const stall = await neaModel.getStallById(stallId);
    if (!stall) return res.status(404).json({ error: "Stall not found" });

    const grade = calculateGradeFromScore(numericScore);
    await neaModel.updateStallGrade(stallId, grade);
    res.json({ message: "Grade updated", stallId, grade, score: numericScore });
  } catch (err) {
    console.error("updateStallGrade error:", err);
    res.status(500).json({ error: "Failed to update grade" });
  }
}

/* ========== INSPECTIONS ========== */

async function listInspections(req, res) {
  try {
    const rows = await neaModel.getAllInspections();
    res.json(rows.map(serializeInspection));
  } catch (err) {
    console.error("listInspections error:", err);
    res.status(500).json({ error: "Failed to load inspections" });
  }
}

async function scheduleInspection(req, res) {
  try {
    const { stallId, date, officer } = req.body;

    if (!stallId || !date || !officer) {
      return res.status(400).json({ error: "stallId, date, and officer are required" });
    }

    const stall = await neaModel.getStallById(stallId);
    if (!stall) return res.status(404).json({ error: "Stall not found" });

    const inspection = await neaModel.createScheduledInspection({
      stallId,
      stallName: stall.StallName,
      date,
      officer,
    });

    res.status(201).json(serializeInspection(inspection));
  } catch (err) {
    console.error("scheduleInspection error:", err);
    res.status(500).json({ error: "Failed to schedule inspection" });
  }
}

async function cancelInspection(req, res) {
  try {
    const { inspectionId } = req.params;
    const inspection = await neaModel.getInspectionById(inspectionId);
    if (!inspection) return res.status(404).json({ error: "Inspection not found" });
    if (inspection.InspectionStatus !== "scheduled") {
      return res.status(400).json({ error: "Only scheduled inspections can be cancelled" });
    }

    await neaModel.cancelInspection(inspectionId);
    res.json({ message: "Inspection cancelled" });
  } catch (err) {
    console.error("cancelInspection error:", err);
    res.status(500).json({ error: "Failed to cancel inspection" });
  }
}

async function deleteInspection(req, res) {
  try {
    const { inspectionId } = req.params;
    const inspection = await neaModel.getInspectionById(inspectionId);
    if (!inspection) return res.status(404).json({ error: "Inspection not found" });

    if (inspection.InspectionStatus !== "cancelled") {
      return res.status(400).json({
        error: "Only cancelled inspections can be permanently deleted",
      });
    }

    await neaModel.deleteInspection(inspectionId);
    res.json({ message: "Inspection deleted" });
  } catch (err) {
    console.error("deleteInspection error:", err);
    res.status(500).json({ error: "Failed to delete inspection" });
  }
}

// Validates score/breakdown ranges and recomputes the grade from the score
// SERVER-SIDE — the old version trusted whatever grade the browser
// calculated and sent. A tampered request could otherwise submit a
// mismatched score/grade pair (e.g. score 40, grade "A").
async function completeInspection(req, res) {
  try {
    const { inspectionId } = req.params;
    const {
      officer,
      date,
      score,
      foodHygiene,
      personalHygiene,
      equipment,
      premises,
      remarks,
      licenseIssued,
      licenseExpiry,
    } = req.body;

    const inspection = await neaModel.getInspectionById(inspectionId);
    if (!inspection) return res.status(404).json({ error: "Inspection not found" });

    if (!officer || !date) {
      return res.status(400).json({ error: "officer and date are required" });
    }

    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) {
      return res.status(400).json({ error: "Score must be a number between 0 and 100" });
    }

    const breakdown = {
      foodHygiene: Number(foodHygiene) || 0,
      personalHygiene: Number(personalHygiene) || 0,
      equipment: Number(equipment) || 0,
      premises: Number(premises) || 0,
    };
    for (const [key, val] of Object.entries(breakdown)) {
      if (val < 0 || val > 100) {
        return res.status(400).json({ error: `${key} must be between 0 and 100` });
      }
    }

    let issuedDate = null;
    let expiryDate = null;
    if (licenseIssued && licenseExpiry) {
      issuedDate = new Date(licenseIssued);
      expiryDate = new Date(licenseExpiry);
      if (expiryDate <= issuedDate) {
        return res
          .status(400)
          .json({ error: "License expiry date must be after the issued date" });
      }
    } else if (licenseIssued || licenseExpiry) {
      return res.status(400).json({
        error: "Provide both license issued and expiry dates, or neither",
      });
    }

    const grade = calculateGradeFromScore(numericScore);

    const updated = await neaModel.completeInspection(inspectionId, {
      officer,
      date,
      score: numericScore,
      grade,
      remarks,
      breakdownJson: JSON.stringify(breakdown),
    });

    if (issuedDate && expiryDate) {
      await neaModel.updateStallGradeAndLicense(
        inspection.StallId,
        grade,
        issuedDate,
        expiryDate,
      );
    } else {
      await neaModel.updateStallGrade(inspection.StallId, grade);
    }

    res.json(serializeInspection(updated));
  } catch (err) {
    console.error("completeInspection error:", err);
    res.status(500).json({ error: "Failed to complete inspection" });
  }
}

/* ========== COMPLAINTS ========== */

async function listComplaints(req, res) {
  try {
    const rows = await neaModel.getAllComplaints();
    res.json(
      rows.map((c) => ({
        id: c.ComplaintId,
        userName: c.UserName || `${c.FirstName || ""} ${c.LastName || ""}`.trim(),
        email: c.Email,
        stall: c.Stall,
        stallName: c.StallName || c.Stall,
        type: c.ComplaintType,
        message: c.Message,
        imageUrl: c.ImageUrl,
        status: c.Status || "under_review",
        createdAt: c.CreatedAt,
        updatedAt: c.UpdatedAt,
      })),
    );
  } catch (err) {
    console.error("listComplaints error:", err);
    res.status(500).json({ error: "Failed to load complaints" });
  }
}

async function updateComplaintStatus(req, res) {
  try {
    const { complaintId } = req.params;
    const { status } = req.body;

    if (!["new", "under_review", "resolved"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const affected = await neaModel.updateComplaintStatus(complaintId, status);
    if (affected === 0) {
      return res.status(404).json({ error: "Complaint not found" });
    }
    res.json({ message: "Complaint status updated", complaintId, status });
  } catch (err) {
    console.error("updateComplaintStatus error:", err);
    res.status(500).json({ error: "Failed to update complaint status" });
  }
}

module.exports = {
  listStalls,
  getGradeOverview,
  updateStallGrade,
  listInspections,
  scheduleInspection,
  cancelInspection,
  deleteInspection,
  completeInspection,
  listComplaints,
  updateComplaintStatus,
};