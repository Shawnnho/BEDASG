const centreModel = require("../models/centreModel");
const stallModel = require("../models/stallModel");
const rentalAgreementModel = require("../models/rentalAgreementModel");
const operatorBillModel = require("../models/operatorBillModel");
const orderModel = require("../models/operatorRevenueModel");

function getCurrentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}


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


async function getStallsForCentre(req, res) {
  try {
    const { centreId } = req.params;
    const stalls = await stallModel.getStallsByCentre(centreId);
    res.json(stalls);
  } catch (err) {
    console.error("getStallsForCentre error:", err.message);
    res.status(500).json({ error: "Failed to retrieve stalls." });
  }
}

async function getRentalsForCentre(req, res) {
  try {
    const { centreId } = req.params;
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

    const stall = await stallModel.getStallById(stallId);
    if (!stall) return res.status(404).json({ error: "Stall not found." });

    const { agreementId } = await rentalAgreementModel.createRentalAgreement({
      stallId: stall.StallId,
      ownerUid: stall.OwnerUid,
      billingUid: stall.OwnerUid,
      centreId,
      stallCentreDocId: stall.StallId,
      ownerName,
      stallName: stall.StallName,
      unitNo: unitNo || null,
      monthlyRent: Number(monthlyRent),
      startDate,
    });

    await operatorBillModel.upsertBill(stall.StallId, getCurrentMonthKey(), centreId, {
      rent: Number(monthlyRent),
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

// DELETE 
async function deleteRental(req, res) {
  try {
    const { agreementId } = req.params;
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

// PUT 
async function saveBill(req, res) {
  try {
    const { stallId, billMonth } = req.params;
    const { centreId, rent, utilities, cleaningFee, penalty, other } = req.body;

    if (!centreId) return res.status(400).json({ error: "centreId is required." });

    const bill = await operatorBillModel.upsertBill(stallId, billMonth, centreId, {
      rent: Number(rent || 0),
      utilities: Number(utilities || 0),
      cleaningFee: Number(cleaningFee || 0),
      penalty: Number(penalty || 0),
      other: Number(other || 0),
    });

    res.json(bill);
  } catch (err) {
    console.error("saveBill error:", err.message);
    res.status(500).json({ error: "Failed to save monthly bill." });
  }
}

module.exports = {
  getMyCentres,
  getOverview,
  getStallsForCentre,
  getRentalsForCentre,
  createRental,
  deleteRental,
  saveBill,
};