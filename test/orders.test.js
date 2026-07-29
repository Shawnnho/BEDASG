// tests/orders.test.js
// Controller tests for the Order/Dashboard endpoints in orderController.js.
// Covers getStallOrders, confirmCash, completeOrder, cancelOrder,
// markRefunded, and bulkUpdateStatus. getDashboard lives in dashboard.test.js.
// Pattern: mock the model, fake req/res, assert on status/json.
// this is for stall order tab 


const orderController = require("../controllers/orderController");
const orderModel = require("../models/orderModel");

jest.mock("../models/orderModel");

jest.mock("../dbConfig", () => ({ poolPromise: Promise.resolve({}), sql: {} }));

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

/* ===================== getStallOrders ===================== */
describe("orderController.getStallOrders", () => {
  it("returns grouped orders (200) on success", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1", Name: "Owner" });
    orderModel.getStallName.mockResolvedValue("Kopi-Fellas");
    orderModel.getStallOrdersForPage.mockResolvedValue([
      {
        OrderId: "o1",
        OrderNo: 1,
        CustomerName: "Alice",
        OrderStatus: "pending_payment",
        PaymentMethod: "cash",
        TotalAmount: 5,
      },
    ]);
    orderModel.getItemsForOrders.mockResolvedValue([]);
    orderModel.getPendingRefunds.mockResolvedValue([]);

    const req = { user: { userId: "u1" } };
    const res = mockRes();

    await orderController.getStallOrders(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.stallName).toBe("Kopi-Fellas");
    // unpaid cash order lands in the unpaidCash bucket
    expect(payload.unpaidCash).toHaveLength(1);
    expect(payload.paid).toHaveLength(0);
  });

  it("returns 401 when not authenticated", async () => {
    const req = { user: {} };
    const res = mockRes();
    await orderController.getStallOrders(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 404 when no stall linked", async () => {
    orderModel.getUserInfo.mockResolvedValue({ Name: "No Stall" });
    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await orderController.getStallOrders(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 500 when the model throws", async () => {
    orderModel.getUserInfo.mockRejectedValue(new Error("DB"));
    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await orderController.getStallOrders(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ===================== confirmCash ===================== */
describe("orderController.confirmCash", () => {
  it("confirms cash (200) on success", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    orderModel.confirmCashReceived.mockResolvedValue(1);
    const req = { user: { userId: "u1" }, body: { orderId: "o1" } };
    const res = mockRes();
    await orderController.confirmCash(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("returns 400 when orderId missing", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    const req = { user: { userId: "u1" }, body: {} };
    const res = mockRes();
    await orderController.confirmCash(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 409 when nothing was updated", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    orderModel.confirmCashReceived.mockResolvedValue(0);
    const req = { user: { userId: "u1" }, body: { orderId: "o1" } };
    const res = mockRes();
    await orderController.confirmCash(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

/* ===================== completeOrder ===================== */
describe("orderController.completeOrder", () => {
  it("completes an order (200)", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    orderModel.updateOrderStatus.mockResolvedValue(1);
    const req = { user: { userId: "u1" }, body: { orderId: "o1" } };
    const res = mockRes();
    await orderController.completeOrder(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("returns 400 when orderId missing", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    const req = { user: { userId: "u1" }, body: {} };
    const res = mockRes();
    await orderController.completeOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 409 when order not found / not yours", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    orderModel.updateOrderStatus.mockResolvedValue(0);
    const req = { user: { userId: "u1" }, body: { orderId: "o1" } };
    const res = mockRes();
    await orderController.completeOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

/* ===================== cancelOrder ===================== */
describe("orderController.cancelOrder", () => {
  it("returns 400 on an invalid reason", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    const req = {
      user: { userId: "u1" },
      body: { orderId: "o1", reason: "not_a_real_reason" },
    };
    const res = mockRes();
    await orderController.cancelOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("cancels an unpaid order (200), no refund required", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    orderModel.getOrderForCancel.mockResolvedValue({
      OrderStatus: "pending_payment",
      PaymentStatus: "unpaid",
      TotalAmount: 5,
    });
    orderModel.cancelOrder.mockResolvedValue(1);
    const req = {
      user: { userId: "u1" },
      body: { orderId: "o1", reason: "out_of_stock" },
    };
    const res = mockRes();
    await orderController.cancelOrder(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.ok).toBe(true);
    expect(payload.refundRequired).toBe(false);
  });

  it("flags a refund when cancelling a paid order", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    orderModel.getOrderForCancel.mockResolvedValue({
      OrderStatus: "processing",
      PaymentStatus: "paid",
      TotalAmount: 12,
    });
    orderModel.cancelOrder.mockResolvedValue(1);
    const req = {
      user: { userId: "u1" },
      body: { orderId: "o1", reason: "stall_closed" },
    };
    const res = mockRes();
    await orderController.cancelOrder(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.refundRequired).toBe(true);
    expect(payload.refundAmount).toBe(12);
  });

  it("returns 409 when the order is already cancelled", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    orderModel.getOrderForCancel.mockResolvedValue({
      OrderStatus: "cancelled",
    });
    const req = {
      user: { userId: "u1" },
      body: { orderId: "o1", reason: "other" },
    };
    const res = mockRes();
    await orderController.cancelOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("returns 404 when the order is not found", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    orderModel.getOrderForCancel.mockResolvedValue(null);
    const req = {
      user: { userId: "u1" },
      body: { orderId: "o1", reason: "other" },
    };
    const res = mockRes();
    await orderController.cancelOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ===================== markRefunded ===================== */
describe("orderController.markRefunded", () => {
  it("marks a refund (200)", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    orderModel.markRefunded.mockResolvedValue(1);
    const req = { user: { userId: "u1" }, body: { orderId: "o1" } };
    const res = mockRes();
    await orderController.markRefunded(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("returns 400 when orderId missing", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    const req = { user: { userId: "u1" }, body: {} };
    const res = mockRes();
    await orderController.markRefunded(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 409 when no pending refund", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    orderModel.markRefunded.mockResolvedValue(0);
    const req = { user: { userId: "u1" }, body: { orderId: "o1" } };
    const res = mockRes();
    await orderController.markRefunded(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

/* ===================== bulkUpdateStatus ===================== */
describe("orderController.bulkUpdateStatus", () => {
  it("updates multiple orders (200) and reports the count", async () => {
    orderModel.getStallIdByUser.mockResolvedValue("s1");
    orderModel.updateOrderStatus.mockResolvedValue(1);
    const req = {
      user: { userId: "u1" },
      body: { orderIds: ["o1", "o2"], status: "in-progress" },
    };
    const res = mockRes();
    await orderController.bulkUpdateStatus(req, res);
    expect(res.json).toHaveBeenCalledWith({ updated: 2 });
  });

  it("returns 400 when no orders selected", async () => {
    orderModel.getStallIdByUser.mockResolvedValue("s1");
    const req = { user: { userId: "u1" }, body: { orderIds: [], status: "pending" } };
    const res = mockRes();
    await orderController.bulkUpdateStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 on an invalid status", async () => {
    orderModel.getStallIdByUser.mockResolvedValue("s1");
    const req = {
      user: { userId: "u1" },
      body: { orderIds: ["o1"], status: "bogus" },
    };
    const res = mockRes();
    await orderController.bulkUpdateStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when no stall linked", async () => {
    orderModel.getStallIdByUser.mockResolvedValue(null);
    const req = {
      user: { userId: "u1" },
      body: { orderIds: ["o1"], status: "pending" },
    };
    const res = mockRes();
    await orderController.bulkUpdateStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});