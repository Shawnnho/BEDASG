jest.mock("../models/centreModel");
jest.mock("../models/stallModel");
jest.mock("../models/rentalAgreementModel");
jest.mock("../models/operatorbillModel");
jest.mock("../models/operatorRevenueModel");
jest.mock("../models/stallRatingModel");
jest.mock("../models/stallComplaintHistoryModel");
jest.mock("../models/feedbackreportModel");
jest.mock("../models/stallReviewModel");
jest.mock("../dbConfig");


const centreModel = require("../models/centreModel");
const stallModel = require("../models/stallModel");
const operatorBillModel = require("../models/operatorbillModel");

const { saveBill } = require("../controllers/operatorController");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function baseReq() {
  return {
    params: { stallId: "asia-wok", billMonth: "2026-07" },
    body: { centreId: "maxwell", rent: 2500, utilities: 100 },
    user: { userId: "operator1" },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  centreModel.getCentreForOperator.mockResolvedValue({ CentreId: "maxwell" });
  stallModel.getStallCentreId.mockResolvedValue({ CentreId: "maxwell" });
  operatorBillModel.updateBill.mockResolvedValue({ TotalAmount: 2600 });
});

describe("saveBill — paid-bill edit lock", () => {
  test("blocks with 403 when the bill has already been paid", async () => {
    operatorBillModel.getBill.mockResolvedValue({ IsPaid: true });

    const req = baseReq();
    const res = mockRes();
    await saveBill(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("already been paid") }),
    );
    expect(operatorBillModel.updateBill).not.toHaveBeenCalled();
  });

  test("allows the edit when the bill is unpaid", async () => {
    operatorBillModel.getBill.mockResolvedValue({ IsPaid: false });

    const req = baseReq();
    const res = mockRes();
    await saveBill(req, res);

    expect(operatorBillModel.updateBill).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ TotalAmount: 2600 }));
  });

  test("allows the edit when there's no existing bill row yet", async () => {
    operatorBillModel.getBill.mockResolvedValue(null);

    const req = baseReq();
    const res = mockRes();
    await saveBill(req, res);

    expect(operatorBillModel.updateBill).toHaveBeenCalled();
  });
});