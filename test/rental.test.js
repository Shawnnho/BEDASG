// tests/rental.test.js
// Controller tests for rentalController.js (rental bill status/pay/notifications).
// Mocks paymentModel.

const rentalController = require("../controllers/rentalController");
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

/* ===================== getStatus ===================== */
describe("rentalController.getStatus", () => {
  it("returns bill status (200) when a bill exists", async () => {
    paymentModel.getStallForOwner.mockResolvedValue({
      StallId: "s1",
      CentreId: "c1",
      StallName: "Kopi-Fellas",
    });
    paymentModel.getBillStatusForStall.mockResolvedValue({
      total: 3000,
      month: "2026-07",
      dueDate: "2026-07-25",
      status: "unpaid",
      isPaid: false,
      isOverdue: false,
      daysUntilDue: 5,
      inReminderWindow: true,
    });
    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await rentalController.getStatus(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.hasBill).toBe(true);
    expect(payload.amount).toBe(3000);
    expect(payload.showPopup).toBe(true);
  });

  it("returns hasBill:false when there's no bill", async () => {
    paymentModel.getStallForOwner.mockResolvedValue({ StallId: "s1", CentreId: "c1" });
    paymentModel.getBillStatusForStall.mockResolvedValue(null);
    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await rentalController.getStatus(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ hasBill: false, isPaid: true }),
    );
  });

  it("returns 404 when no stall found", async () => {
    paymentModel.getStallForOwner.mockResolvedValue(null);
    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await rentalController.getStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ===================== payRent ===================== */
describe("rentalController.payRent", () => {
  it("pays the bill (200) and returns a reference", async () => {
    paymentModel.getStallForOwner.mockResolvedValue({ StallId: "s1", CentreId: "c1" });
    paymentModel.getBillStatusForStall.mockResolvedValue({
      total: 3000,
      month: "2026-07",
      isPaid: false,
    });
    paymentModel.markOperatorBillPaid.mockResolvedValue(true);
    const req = { user: { userId: "u1" }, body: { method: "paynow" } };
    const res = mockRes();
    await rentalController.payRent(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.ok).toBe(true);
    expect(payload.amount).toBe(3000);
    expect(payload.reference).toMatch(/^SIM-/);
  });

  it("returns 404 when no stall found", async () => {
    paymentModel.getStallForOwner.mockResolvedValue(null);
    const req = { user: { userId: "u1" }, body: {} };
    const res = mockRes();
    await rentalController.payRent(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 404 when there's no bill", async () => {
    paymentModel.getStallForOwner.mockResolvedValue({ StallId: "s1", CentreId: "c1" });
    paymentModel.getBillStatusForStall.mockResolvedValue(null);
    const req = { user: { userId: "u1" }, body: {} };
    const res = mockRes();
    await rentalController.payRent(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 409 when the bill is already paid", async () => {
    paymentModel.getStallForOwner.mockResolvedValue({ StallId: "s1", CentreId: "c1" });
    paymentModel.getBillStatusForStall.mockResolvedValue({
      total: 3000,
      month: "2026-07",
      isPaid: true,
    });
    const req = { user: { userId: "u1" }, body: {} };
    const res = mockRes();
    await rentalController.payRent(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

/* ===================== getNotifications ===================== */
describe("rentalController.getNotifications", () => {
  it("returns notifications + history (200)", async () => {
    paymentModel.getStallForOwner.mockResolvedValue({ StallId: "s1", CentreId: "c1" });
    paymentModel.getBillStatusForStall.mockResolvedValue({
      total: 3000,
      month: "2026-07",
      status: "unpaid",
      isOverdue: true,
      dueDate: "2026-07-25",
      isPaid: false,
    });
    paymentModel.getRentalPayments.mockResolvedValue([
      { PaymentId: "p1", Amount: 3000, PaymentMethod: "paynow", PaymentMonth: "2026-06" },
    ]);
    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await rentalController.getNotifications(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.hasBill).toBe(true);
    expect(payload.history).toHaveLength(1);
    // overdue unpaid bill produces a notification
    expect(payload.notifications.length).toBeGreaterThan(0);
    expect(payload.notifications[0].severity).toBe("overdue");
  });

  it("returns 404 when no stall found", async () => {
    paymentModel.getStallForOwner.mockResolvedValue(null);
    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await rentalController.getNotifications(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});