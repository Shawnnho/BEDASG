const hygieneModel = require("../models/hygieneModel");

function parseBreakdown(json) {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function listStalls(req, res) {
  try {
    const stalls = await hygieneModel.getStallsForRole(
      req.user.userId,
      req.user.role,
    );
    res.json(stalls);
  } catch (err) {
    console.error("listStalls error:", err);
    res.status(500).json({ error: "Failed to load stalls" });
  }
}

async function getStall(req, res) {
  try {
    const stall = await hygieneModel.getStallSummary(req.params.stallId);
    if (!stall) return res.status(404).json({ error: "Stall not found" });

    const isOwner = stall.OwnerUid === req.user.userId;
    const isOfficer = req.user.role === "nea_officer";
    let upcoming = null;
    if (isOwner || isOfficer) {
      upcoming = await hygieneModel.getUpcomingInspection(stall.StallId);
    }

    res.json({
      stallId: stall.StallId,
      name: stall.StallName,
      imageUrl: stall.ImageUrl,
      centreId: stall.CentreId,
      grade: stall.HygieneGrade || null,
      licenseIssued: stall.LicenseIssued,
      licenseExpiry: stall.LicenseExpiry,
      isOwner,
      upcoming,
    });
  } catch (err) {
    console.error("getStall error:", err);
    res.status(500).json({ error: "Failed to load stall" });
  }
}

async function getInspections(req, res) {
  try {
    const rows = await hygieneModel.getCompletedInspections(req.params.stallId);
    const inspections = rows.map((r) => ({
      date: r.DateTs,
      dateLabel: r.InspectionDate,
      score: r.InspectionScore,
      grade: r.InspectionGrade,
      remarks: r.Remarks || "No remarks provided",
      officer: r.OfficerName,
      breakdown: parseBreakdown(r.BreakdownJson),
    }));
    res.json(inspections);
  } catch (err) {
    console.error("getInspections error:", err);
    res.status(500).json({ error: "Failed to load inspections" });
  }
}

async function getMarketComparison(req, res) {
  try {
    const { stallId } = req.params;
    const stall = await hygieneModel.getStallSummary(stallId);
    if (!stall) return res.status(404).json({ error: "Stall not found" });

    if (!stall.CentreId) {
      return res.json({
        ranking: null,
        percentile: null,
        avgScore: null,
        stallScore: null,
        totalStalls: 0,
      });
    }

    const stallIds = await hygieneModel.getCentreStallIds(stall.CentreId);
    const scores = [];
    for (const id of stallIds) {
      const score = await hygieneModel.getLatestCompletedScore(id);
      if (score !== null) scores.push({ stallId: id, score });
    }

    if (scores.length < 2) {
      return res.json({
        ranking: null,
        percentile: null,
        avgScore: null,
        stallScore: null,
        totalStalls: scores.length,
      });
    }

    scores.sort((a, b) => b.score - a.score);
    const ranking = scores.findIndex((s) => s.stallId === stallId) + 1;
    const total = scores.length;
    const percentile = Math.round(((total - ranking) / (total - 1)) * 100);
    const avgScore = Math.round(
      scores.reduce((sum, s) => sum + s.score, 0) / total,
    );
    const stallScore = scores.find((s) => s.stallId === stallId)?.score ?? null;

    res.json({ ranking, percentile, avgScore, stallScore, totalStalls: total });
  } catch (err) {
    console.error("getMarketComparison error:", err);
    res.status(500).json({ error: "Failed to load market comparison" });
  }
}

module.exports = { listStalls, getStall, getInspections, getMarketComparison };
