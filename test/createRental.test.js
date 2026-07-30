jest.mock("../dbConfig");

jest.mock("../models/centreModel");
jest.mock("../models/stallModel");
jest.mock("../models/rentalAgreementModel");
jest.mock("../models/operatorbillModel");
jest.mock("../models/operatorRevenueModel");
jest.mock("../models/stallRatingModel");
jest.mock("../models/stallComplaintHistoryModel");
jest.mock("../models/feedbackreportModel");
jest.mock("../models/stallReviewModel");

const rentalAgreementModel = require("../models/rentalAgreementModel");
const operatorBillModel = require("../models/operatorbillModel");

const { createRental } = require("../controllers/operatorController");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// Ownership/existence are now handled by operatorAuth middleware BEFORE the
// controller runs — so req.stall must already be attached here, matching
// what requireStallExists would have set.
function baseReq() {
  return {
    body: {
      centreId: "maxwell",
      ownerName: "Ah Tan",
      monthlyRent: 2500,
      startDate: "2026-07-01",
    },
    stall: {
      StallId: "asia-wok",
      CentreId: "maxwell",
      OwnerUid: "owner1",
      StallName: "Asia Wok",
    },
    user: { userId: "operator1" },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  rentalAgreementModel.createRentalAgreement.mockResolvedValue({ agreementId: "new-agreement-1" });
  operatorBillModel.deleteBill.mockResolvedValue();
  operatorBillModel.updateBill.mockResolvedValue({ TotalAmount: 2500 });
});

describe("createRental — paid + past-due gate", () => {
  test("blocks with 409 when the stall's last bill is unpaid", async () => {
    operatorBillModel.getLatestBillForStall.mockResolvedValue({
      IsPaid: false,
      DueDate: "2026-06-01",
    });

    const req = baseReq();
    const res = mockRes();
    await createRental(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("unpaid") }),
    );
    expect(rentalAgreementModel.createRentalAgreement).not.toHaveBeenCalled();
  });

  test("blocks with 409 when paid but the due date hasn't passed yet", async () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);

    operatorBillModel.getLatestBillForStall.mockResolvedValue({
      IsPaid: true,
      DueDate: future.toISOString(),
    });

    const req = baseReq();
    const res = mockRes();
    await createRental(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("due date has passed") }),
    );
    expect(rentalAgreementModel.createRentalAgreement).not.toHaveBeenCalled();
  });

  test("succeeds with 201 when paid and past due", async () => {
    const past = new Date();
    past.setDate(past.getDate() - 10);

    operatorBillModel.getLatestBillForStall.mockResolvedValue({
      IsPaid: true,
      DueDate: past.toISOString(),
    });

    const req = baseReq();
    const res = mockRes();
    await createRental(req, res);

    expect(rentalAgreementModel.createRentalAgreement).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("succeeds with 201 when the stall has no bill history at all (first-ever agreement)", async () => {
    operatorBillModel.getLatestBillForStall.mockResolvedValue(null);

    const req = baseReq();
    const res = mockRes();
    await createRental(req, res);

    expect(rentalAgreementModel.createRentalAgreement).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});