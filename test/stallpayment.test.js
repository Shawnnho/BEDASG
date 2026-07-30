// tests/payment.test.js
// Controller tests for paymentController.js (Manage Payment page).
// Mocks paymentModel.

const paymentController = require("../controllers/paymentController");
const paymentModel = require("../models/paymentModel");

jest.mock("../models/paymentModel");
jest.mock("../dbConfig", () => ({ poolPromise: Promise.resolve({}), sql: {} }));

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

/* ===================== getSummary ===================== */
describe("paymentController.getSummary", () => {
  it("returns the payment summary (200)", async () => {
    paymentModel.getStallForOwner.mockResolvedValue({
      StallId: "s1",
      CentreId: "c1",
      StallName: "Kopi-Fellas",
    });
    paymentModel.ensureOperatorBill.mockResolvedValue({
      BillId: "b1",
      BillMonth: "2026-07",
      RentAmount: 3000,
      IsPaid: false,
      TotalAmount: 3000,
    });
    paymentModel.getPaymentsForMonth.mockResolvedValue([]);
    paymentModel.getOperatorPaidLifetime.mockResolvedValue(9000);

    const req = { user: { userId: "u1" }, query: {} };
    const res = mockRes();
    await paymentController.getSummary(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.stall.stallName).toBe("Kopi-Fellas");
    expect(payload.bill.total).toBe(3000);
    expect(payload.totals.operatorDue).toBe(3000); // unpaid → full amount due
  });

  it("returns 404 when no stall found", async () => {
    paymentModel.getStallForOwner.mockResolvedValue(null);
    const req = { user: { userId: "u1" }, query: {} };
    const res = mockRes();
    await paymentController.getSummary(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 500 when the model throws", async () => {
    paymentModel.getStallForOwner.mockRejectedValue(new Error("DB"));
    const req = { user: { userId: "u1" }, query: {} };
    const res = mockRes();
    await paymentController.getSummary(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ===================== payOperator ===================== */
describe("paymentController.payOperator", () => {
  it("pays the operator bill (200)", async () => {
    paymentModel.getStallForOwner.mockResolvedValue({
      StallId: "s1",
      CentreId: "c1",
    });
    paymentModel.ensureOperatorBill.mockResolvedValue({
      BillId: "b1",
      BillMonth: "2026-07",
      TotalAmount: 3000,
      IsPaid: false,
    });
    paymentModel.markOperatorBillPaid.mockResolvedValue(true);

    const req = {
      user: { userId: "u1" },
      body: { month: "2026-07", method: "paynow" },
    };
    const res = mockRes();
    await paymentController.payOperator(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.ok).toBe(true);
    expect(payload.amount).toBe(3000);
  });

  it("returns 404 when no stall found", async () => {
    paymentModel.getStallForOwner.mockResolvedValue(null);
    const req = { user: { userId: "u1" }, body: {} };
    const res = mockRes();
    await paymentController.payOperator(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 404 when there's no bill to pay", async () => {
    paymentModel.getStallForOwner.mockResolvedValue({
      StallId: "s1",
      CentreId: "c1",
    });
    paymentModel.ensureOperatorBill.mockResolvedValue(null);
    const req = { user: { userId: "u1" }, body: {} };
    const res = mockRes();
    await paymentController.payOperator(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 409 when the bill is already paid", async () => {
    paymentModel.getStallForOwner.mockResolvedValue({
      StallId: "s1",
      CentreId: "c1",
    });
    paymentModel.ensureOperatorBill.mockResolvedValue({
      BillId: "b1",
      BillMonth: "2026-07",
      TotalAmount: 3000,
      IsPaid: true,
    });
    const req = { user: { userId: "u1" }, body: {} };
    const res = mockRes();
    await paymentController.payOperator(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

/* ===================== payStaff ===================== */
describe("paymentController.payStaff", () => {
  it("returns 501 (not implemented yet)", async () => {
    const req = { user: { userId: "u1" }, body: {} };
    const res = mockRes();
    await paymentController.payStaff(req, res);
    expect(res.status).toHaveBeenCalledWith(501);
  });
});
