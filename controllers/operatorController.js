const centreModel = require("../models/centreModel");
const stallModel = require("../models/stallModel");
const rentalAgreementModel = require("../models/rentalAgreementModel");
const operatorBillModel = require("../models/operatorbillModel");
const orderModel = require("../models/operatorRevenueModel");
const stallRatingModel = require("../models/stallRatingModel");
const stallComplaintHistoryModel = require("../models/stallComplaintHistoryModel");

function getCurrentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// GET /api/operator/centres

async function getMyCentres(req, res) {
  try {
    const operatorId = req.user.userId; 
    const centres = await centreModel.getCentresByOperator(operatorId);

    const centreIds = centres.map((c) => c.CentreId);
    const revenueByCentre = await orderModel.getCompletedRevenueByCentreIds(centreIds);

    const withRevenue = centres.map((c) => ({
      ...c,
      Revenue: revenueByCentre[c.CentreId] || 0,
    }));

    res.json(withRevenue);
  } catch (err) {
    console.error("getMyCentres error:", err.message);
    res.status(500).json({ error: "Failed to retrieve centres." });
  }
}

// GET /api/operator/overview
async function getOverview(req, res) {
  try {
    const operatorId = req.user.userId;
    const centres = await centreModel.getCentresByOperator(operatorId);
    const centreIds = centres.map((c) => c.CentreId);

    const revenueByCentre = await orderModel.getCompletedRevenueByCentreIds(centreIds);
    const totalRevenue = Object.values(revenueByCentre).reduce((sum, v) => sum + v, 0);

    let totalStalls = 0;
    let totalRentals = 0;

    for (const c of centres) {
      const stalls = await stallModel.getStallsByCentre(c.CentreId);
      totalStalls += stalls.length;

      const rentals = await rentalAgreementModel.getRentalAgreementsByCentre(c.CentreId);
      totalRentals += rentals.length;
    }

    res.json({
      centres: centres.length,
      totalStalls,
      totalRentals,
      totalRevenue,
    });
  } catch (err) {
    console.error("getOverview error:", err.message);
    res.status(500).json({ error: "Failed to compute overview." });
  }
}

// GET /api/operator/centres/:centreId/stalls

async function getStallsForCentre(req, res) {
  try {
    const { centreId } = req.params;
    const operatorId = req.user.userId;
    const centre = await centreModel.getCentreForOperator(centreId, operatorId);
    if (!centre) return res.status(403).json({ error: "Forbidden: not your centre." });

    const stalls = await stallModel.getStallsByCentre(centreId);

    const stallIds = stalls.map((s) => s.StallId);
    const revenueByStall = await orderModel.getCompletedRevenueByStallIds(stallIds);
    const ratingByStall = await stallRatingModel.getAverageRatingsByStallIds(stallIds);

    const withExtras = stalls.map((s) => ({
      ...s,
      Revenue: revenueByStall[s.StallId] || 0,
      AvgRating: ratingByStall[s.StallId]?.avgRating || 0,
      ReviewCount: ratingByStall[s.StallId]?.reviewCount || 0,
    }));

    res.json(withExtras);
  } catch (err) {
    console.error("getStallsForCentre error:", err.message);
    res.status(500).json({ error: "Failed to retrieve stalls." });
  }
}

// GET /api/operator/centres/:centreId/rentals

async function getRentalsForCentre(req, res) {
  try {
    const { centreId } = req.params;
    const operatorId = req.user.userId;
    const centre = await centreModel.getCentreForOperator(centreId, operatorId);
    if (!centre) return res.status(403).json({ error: "Forbidden: not your centre." });

    const agreements = await rentalAgreementModel.getRentalAgreementsByCentre(centreId);
    const monthKey = getCurrentMonthKey();

    const withBills = await Promise.all(
      agreements.map(async (ra) => {
        const bill = await operatorBillModel.ensureBill(
          ra.StallId,
          centreId,
          monthKey,
          ra.MonthlyRent,
        );
        return { ...ra, bill };
      }),
    );

    res.json({ monthKey, agreements: withBills });
  } catch (err) {
    console.error("getRentalsForCentre error:", err.message);
    res.status(500).json({ error: "Failed to retrieve rental agreements." });
  }
}

// GET /api/operator/stalls 
async function getAllStallsForOperator(req, res) {
  try {
    const operatorId = req.user.userId;
    const centres = await centreModel.getCentresByOperator(operatorId);

    const allStalls = [];
    for (const c of centres) {
      const stalls = await stallModel.getStallsByCentre(c.CentreId);
      for (const s of stalls) {
        allStalls.push({ ...s, CentreName: c.Name });
      }
    }

    const stallIds = allStalls.map((s) => s.StallId);
    const revenueByStall = await orderModel.getCompletedRevenueByStallIds(stallIds);
    const ratingByStall = await stallRatingModel.getAverageRatingsByStallIds(stallIds);

    const withExtras = allStalls.map((s) => ({
      ...s,
      Revenue: revenueByStall[s.StallId] || 0,
      AvgRating: ratingByStall[s.StallId]?.avgRating || 0,
      ReviewCount: ratingByStall[s.StallId]?.reviewCount || 0,
    }));

    withExtras.sort((a, b) => (a.StallName || "").localeCompare(b.StallName || ""));
    res.json(withExtras);
  } catch (err) {
    console.error("getAllStallsForOperator error:", err.message);
    res.status(500).json({ error: "Failed to retrieve stalls." });
  }
}

// GET /api/operator/rentals 
async function getAllRentalsForOperator(req, res) {
  try {
    const operatorId = req.user.userId;
    const centres = await centreModel.getCentresByOperator(operatorId);
    const monthKey = getCurrentMonthKey();

    const allAgreements = [];
    for (const c of centres) {
      const agreements = await rentalAgreementModel.getRentalAgreementsByCentre(c.CentreId);
      for (const ra of agreements) {
        const bill = await operatorBillModel.ensureBill(ra.StallId, c.CentreId, monthKey, ra.MonthlyRent);
        allAgreements.push({ ...ra, CentreName: c.Name, bill });
      }
    }

    res.json({ monthKey, agreements: allAgreements });
  } catch (err) {
    console.error("getAllRentalsForOperator error:", err.message);
    res.status(500).json({ error: "Failed to retrieve rental agreements." });
  }
}

// POST /api/operator/rentals

async function createRental(req, res) {
  try {
    const {
      centreId,
      stallId,
      ownerName,
      monthlyRent,
      startDate,
      unitNo,
      utilities,
      cleaningFee,
      penalty,
      other,
    } = req.body;

    if (!centreId || !stallId)
      return res.status(400).json({ error: "centreId and stallId are required." });
    if (!ownerName)
      return res.status(400).json({ error: "Owner name is required." });
    if (!startDate)
      return res.status(400).json({ error: "Start date is required." });
    if (!Number.isFinite(Number(monthlyRent)) || Number(monthlyRent) < 0)
      return res.status(400).json({ error: "Monthly rent must be 0 or more." });

    const operatorId = req.user.userId;
    const centre = await centreModel.getCentreForOperator(centreId, operatorId);
    if (!centre) return res.status(403).json({ error: "Forbidden: not your centre." });

    const stall = await stallModel.getStallById(stallId);
    if (!stall) return res.status(404).json({ error: "Stall not found." });
    if (stall.CentreId !== centreId)
      return res.status(400).json({ error: "Stall does not belong to this centre." });

    const existing = await rentalAgreementModel.getRentalAgreementByStallId(stall.StallId);
    if (existing) {
      const latestBill = await operatorBillModel.getLatestBillForStall(stall.StallId);
      const currentMonthKey = getCurrentMonthKey();
      const isPaid = latestBill?.IsPaid === true || latestBill?.IsPaid === 1;
      const isNewMonth = !latestBill || latestBill.BillMonth !== currentMonthKey;

      if (!(isPaid && isNewMonth)) {
        return res.status(409).json({
          error: isPaid
            ? "This stall's agreement can only be renewed in a new month."
            : "This stall's current rental agreement is unpaid — settle it before creating a new one.",
        });
      }

      await rentalAgreementModel.deleteRentalAgreement(existing.AgreementId);
    }

    const baseRent = Number(monthlyRent);
    const combinedTotal =
      baseRent +
      Number(utilities || 0) +
      Number(cleaningFee || 0) +
      Number(penalty || 0) +
      Number(other || 0);

    const { agreementId } = await rentalAgreementModel.createRentalAgreement({
      stallId: stall.StallId,
      ownerUid: stall.OwnerUid,
      billingUid: stall.OwnerUid,
      centreId,
      stallCentreDocId: stall.StallId,
      ownerName,
      stallName: stall.StallName,
      unitNo: unitNo || null,
      monthlyRent: combinedTotal,
      startDate,
    });

    await operatorBillModel.updateBill(stall.StallId, getCurrentMonthKey(), centreId, {
      rent: baseRent,
      utilities: Number(utilities || 0),
      cleaningFee: Number(cleaningFee || 0),
      penalty: Number(penalty || 0),
      other: Number(other || 0),
    });

    res.status(201).json({ agreementId });
  } catch (err) {
    console.error("createRental error:", err.message);
    res.status(500).json({ error: "Failed to create rental agreement." });
  }
}

// DELETE /api/operator/rentals/:agreementId
async function deleteRental(req, res) {
  try {
    const { agreementId } = req.params;
    const operatorId = req.user.userId;

    const agreement = await rentalAgreementModel.getRentalAgreementById(agreementId);
    if (!agreement) {
      return res.status(404).json({ error: "Rental agreement not found." });
    }
    const centre = await centreModel.getCentreForOperator(agreement.CentreId, operatorId);
    if (!centre) return res.status(403).json({ error: "Forbidden: not your centre." });

    const deleted = await rentalAgreementModel.deleteRentalAgreement(agreementId);
    if (!deleted) {
      return res.status(404).json({ error: "Rental agreement not found." });
    }

    res.status(204).send();
  } catch (err) {
    console.error("deleteRental error:", err.message);
    res.status(500).json({ error: "Failed to delete rental agreement." });
  }
}

// PUT /api/operator/bills/:stallId/:billMonth

async function saveBill(req, res) {
  try {
    const { stallId, billMonth } = req.params;
    const { centreId, agreementId, rent, utilities, cleaningFee, penalty, other } = req.body;

    if (!centreId) return res.status(400).json({ error: "centreId is required." });

    const operatorId = req.user.userId;
    const centre = await centreModel.getCentreForOperator(centreId, operatorId);
    if (!centre) return res.status(403).json({ error: "Forbidden: not your centre." });

    const stall = await stallModel.getStallCentreId(stallId);
    if (!stall) return res.status(404).json({ error: "Stall not found." });
    if (stall.CentreId !== centreId)
      return res.status(400).json({ error: "Stall does not belong to this centre." });

    const bill = await operatorBillModel.updateBill(stallId, billMonth, centreId, {
      rent: Number(rent || 0),
      utilities: Number(utilities || 0),
      cleaningFee: Number(cleaningFee || 0),
      penalty: Number(penalty || 0),
      other: Number(other || 0),
    });

    if (agreementId) {
      await rentalAgreementModel.updateMonthlyRent(agreementId, bill.TotalAmount);
    }

    res.json(bill);
  } catch (err) {
    console.error("saveBill error:", err.message);
    res.status(500).json({ error: "Failed to save monthly bill." });
  }
}

// GET /api/operator/stalls/:stallId/complaints
async function getStallComplaints(req, res) {
  try {
    const { stallId } = req.params;
    const operatorId = req.user.userId;

    const stall = await stallModel.getStallCentreId(stallId);
    if (!stall) return res.status(404).json({ error: "Stall not found." });
    const centre = await centreModel.getCentreForOperator(stall.CentreId, operatorId);
    if (!centre) return res.status(403).json({ error: "Forbidden: not your centre." });

    const complaints = await stallComplaintHistoryModel.getComplaintsByStall(stallId);
    res.json(complaints);
  } catch (err) {
    console.error("getStallComplaints error:", err.message);
    res.status(500).json({ error: "Failed to retrieve complaint history." });
  }
}

module.exports = {
  getMyCentres,
  getOverview,
  getStallsForCentre,
  getRentalsForCentre,
  getAllStallsForOperator,
  getAllRentalsForOperator,
  createRental,
  deleteRental,
  saveBill,
  getStallComplaints,
};