const centreModel = require("../models/centreModel");
const stallModel = require("../models/stallModel");
const rentalAgreementModel = require("../models/rentalAgreementModel");
const operatorBillModel = require("../models/operatorbillModel");
const orderModel = require("../models/operatorRevenueModel");
const stallRatingModel = require("../models/stallRatingModel");
const stallComplaintHistoryModel = require("../models/stallComplaintHistoryModel");
const feedbackReportModel = require("../models/feedbackreportModel");
const stallReviewModel = require("../models/stallReviewModel");
const userLookupModel = require("../models/userLookupModel");
const { sendReportDismissedAlert, sendReviewDeletedAlert } = require("../services/notificationEmails");

function getCurrentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// GET /api/operator/centres
// Retrieves all centres that the operator owns
async function getMyCentres(req, res) {
  // #swagger.tags = ['Operator']
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
// Retrieves the number of centres owned, the total stalls, the total rental agreements and the total revenue as a number
async function getOverview(req, res) {
  // #swagger.tags = ['Operator']
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
// Retrieves the stalls owned by the operator for a specific centre
async function getStallsForCentre(req, res) {
  // #swagger.tags = ['Operator']
  try {
    const { centreId } = req.params;
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
// Retrieves the Rental Agreements that the operator has given for a specific stall
async function getRentalsForCentre(req, res) {
  // #swagger.tags = ['Operator']
  try {
    const { centreId } = req.params;
    const agreements = await rentalAgreementModel.getRentalAgreementsByCentre(centreId);
    const monthKey = getCurrentMonthKey();

    const withBills = await Promise.all(
      agreements.map(async (ra) => {
        const dueDay = ra.StartDate ? new Date(ra.StartDate).getDate() : 15;
        const bill = await operatorBillModel.ensureBill(
          ra.StallId,
          centreId,
          monthKey,
          ra.MonthlyRent,
          dueDay,
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
// Retrieves all stalls for operator
async function getAllStallsForOperator(req, res) {
  // #swagger.tags = ['Operator']
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
// Retrives all rental agreement for operator
async function getAllRentalsForOperator(req, res) {
  // #swagger.tags = ['Operator']
  try {
    const operatorId = req.user.userId;
    const centres = await centreModel.getCentresByOperator(operatorId);
    const monthKey = getCurrentMonthKey();

    const allAgreements = [];
    for (const c of centres) {
      const agreements = await rentalAgreementModel.getRentalAgreementsByCentre(c.CentreId);
      for (const ra of agreements) {
        const dueDay = ra.StartDate ? new Date(ra.StartDate).getDate() : 15;
        const bill = await operatorBillModel.ensureBill(ra.StallId, c.CentreId, monthKey, ra.MonthlyRent, dueDay);
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
// Creates a Rental Agreement for a stall that the operator has selected
async function createRental(req, res) {
  // #swagger.tags = ['Operator']
  try {
    const {
      centreId,
      ownerName,
      monthlyRent,
      startDate,
      unitNo,
      utilities,
      cleaningFee,
      penalty,
      other,
    } = req.body;
    const stall = req.stall;

    const latestBill = await operatorBillModel.getLatestBillForStall(stall.StallId);
    if (latestBill) {
      const isPaid = latestBill.IsPaid === true || latestBill.IsPaid === 1;
      const isPastDue = !latestBill.DueDate || new Date() > new Date(latestBill.DueDate);

      if (!isPaid) {
        return res.status(409).json({
          error: "This stall's last bill is unpaid — a new agreement can't be created until it's settled.",
        });
      }
      if (!isPastDue) {
        return res.status(409).json({
          error: "A new agreement for this stall can only be created after its last bill's due date has passed.",
        });
      }
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

    const dueDay = new Date(startDate).getDate();

    await operatorBillModel.deleteBill(stall.StallId, getCurrentMonthKey());

    await operatorBillModel.updateBill(
      stall.StallId,
      getCurrentMonthKey(),
      centreId,
      {
        rent: baseRent,
        utilities: Number(utilities || 0),
        cleaningFee: Number(cleaningFee || 0),
        penalty: Number(penalty || 0),
        other: Number(other || 0),
      },
      dueDay,
    );

    res.status(201).json({ agreementId });
  } catch (err) {
    console.error("createRental error:", err.message);
    res.status(500).json({ error: "Failed to create rental agreement." });
  }
}

// DELETE /api/operator/rentals/:agreementId
// Deletes a rental agreement that the user has selected
async function deleteRental(req, res) {
  // #swagger.tags = ['Operator']
  try {
    const agreement = req.agreement;

    const latestBill = await operatorBillModel.getLatestBillForStall(agreement.StallId);
    const isUnpaid = latestBill && latestBill.IsPaid !== true && latestBill.IsPaid !== 1;
    if (isUnpaid) {
      await operatorBillModel.deleteBill(agreement.StallId, latestBill.BillMonth);
    }

    await rentalAgreementModel.deleteRentalAgreement(agreement.AgreementId);
    res.status(204).send();
  } catch (err) {
    console.error("deleteRental error:", err.message);
    res.status(500).json({ error: "Failed to delete rental agreement." });
  }
}

// PUT /api/operator/bills/:stallId/:billMonth
// Updates a rental agreement (provided the stall holder has yet to pay)
async function saveBill(req, res) {
  // #swagger.tags = ['Operator']
  try {
    const { stallId, billMonth } = req.params;
    const { centreId, agreementId, rent, utilities, cleaningFee, penalty, other } = req.body;

    const currentBill = await operatorBillModel.getBill(stallId, billMonth);
    const isAlreadyPaid = currentBill?.IsPaid === true || currentBill?.IsPaid === 1;
    if (isAlreadyPaid) {
      return res.status(403).json({
        error: "This bill has already been paid and can no longer be edited.",
      });
    }

    let dueDay = 15;
    if (agreementId) {
      const agreement = await rentalAgreementModel.getRentalAgreementById(agreementId);
      if (agreement?.StartDate) dueDay = new Date(agreement.StartDate).getDate();
    }

    const bill = await operatorBillModel.updateBill(
      stallId,
      billMonth,
      centreId,
      {
        rent: Number(rent || 0),
        utilities: Number(utilities || 0),
        cleaningFee: Number(cleaningFee || 0),
        penalty: Number(penalty || 0),
        other: Number(other || 0),
      },
      dueDay,
    );

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
// Retrieve all complaints from a stall that the operator owns
async function getStallComplaints(req, res) {
  // #swagger.tags = ['Operator']
  try {
    const { stallId } = req.params;
    const complaints = await stallComplaintHistoryModel.getComplaintsByStall(stallId);
    res.json(complaints);
  } catch (err) {
    console.error("getStallComplaints error:", err.message);
    res.status(500).json({ error: "Failed to retrieve complaint history." });
  }
}

// GET /api/operator/reports
// Retrieve all reports on reviews 
async function getReportedReviews(req, res) {
  // #swagger.tags = ['Operator']
  try {
    const operatorId = req.user.userId;
    const centres = await centreModel.getCentresByOperator(operatorId);
    const centreIds = centres.map((c) => c.CentreId);

    const reports = await feedbackReportModel.getReportsForCentres(centreIds);
    res.json(reports);
  } catch (err) {
    console.error("getReportedReviews error:", err.message);
    res.status(500).json({ error: "Failed to retrieve reported reviews." });
  }
}

// POST /api/operator/reports/:reportId/dismiss
//  Dismisses the Report 
async function dismissReport(req, res) {
  // #swagger.tags = ['Operator']
  try {
    await feedbackReportModel.dismissReport(req.report.ReportId);

    userLookupModel
      .getUserEmail(req.report.ReporterUserId)
      .then((email) => {
        if (email) {
          sendReportDismissedAlert(email, { stallName: req.stall?.StallName });
        }
      })
      .catch((err) => console.error("Report dismissed email failed:", err.message));

    res.status(204).send();
  } catch (err) {
    console.error("dismissReport error:", err.message);
    res.status(500).json({ error: "Failed to dismiss report." });
  }
}

// DELETE /api/operator/reports/:reportId/review
// Deletes the review  that the operator has selected 
async function deleteReportedReview(req, res) {
  // #swagger.tags = ['Operator']
  try {

    await feedbackReportModel.deleteReportsByReviewId(req.review.ReviewId);
    await stallReviewModel.deleteReview(req.review.ReviewId);

    userLookupModel
      .getUserEmail(req.review.UserId)
      .then((email) => {
        if (email) {
          sendReviewDeletedAlert(email, { stallName: req.stall?.StallName });
        }
      })
      .catch((err) => console.error("Review deleted email failed:", err.message));

    res.status(204).send();
  } catch (err) {
    console.error("deleteReportedReview error:", err.message);
    res.status(500).json({ error: "Failed to delete review." });
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
  getReportedReviews,
  dismissReport,
  deleteReportedReview,
};