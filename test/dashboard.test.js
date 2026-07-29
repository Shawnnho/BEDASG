// tests/dashboard.test.js
// Controller tests for getDashboard (serves the stall Dashboard page).
// Pattern matches the existing suite: mock the model, fake req/res, assert.

const orderController = require("../controllers/orderController");
const orderModel = require("../models/orderModel");

jest.mock("../models/orderModel");

jest.mock("../dbConfig", () => ({
  poolPromise: Promise.resolve({}),
  sql: {},
}));

// Small helper to build a fake res with chainable status().json()
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("orderController.getDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns stall name, owner, orders and stats on success (200)", async () => {
    orderModel.getUserInfo.mockResolvedValue({
      StallId: "stall_1",
      Name: "Kopi Owner",
    });
    orderModel.getStallName.mockResolvedValue("Kopi-Fellas");
    orderModel.getOrdersByStall.mockResolvedValue([
      {
        OrderId: "o1",
        OrderNo: 1001,
        CustomerId: "c1",
        CustomerName: "Alice",
        OrderStatus: "processing",
        FirstItemQty: 2,
        FirstItemName: "Kopi",
        ItemCount: 3,
        TotalAmount: 8.4,
        CreatedAt: "2026-07-28T10:00:00Z",
      },
    ]);
    orderModel.getStallStats.mockResolvedValue({ totalSales: 100 });

    const req = { user: { userId: "u1" } };
    const res = mockRes();

    await orderController.getDashboard(req, res);

    expect(orderModel.getUserInfo).toHaveBeenCalledWith("u1");
    expect(res.json).toHaveBeenCalledTimes(1);

    const payload = res.json.mock.calls[0][0];
    expect(payload.stallName).toBe("Kopi-Fellas");
    expect(payload.ownerName).toBe("Kopi Owner");
    expect(payload.stats).toEqual({ totalSales: 100 });
    expect(payload.orders).toHaveLength(1);
    // status is normalised: "processing" -> "in-progress"
    expect(payload.orders[0].status).toBe("in-progress");
    // item summary is built: "2x Kopi + 2 more"
    expect(payload.orders[0].item).toBe("2x Kopi + 2 more");
  });

  it("returns 401 when the request has no authenticated user", async () => {
    const req = { user: {} }; // no userId / UserId
    const res = mockRes();

    await orderController.getDashboard(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Not authenticated" });
    expect(orderModel.getStallName).not.toHaveBeenCalled();
  });

  it("returns 404 when the user has no linked stall", async () => {
    orderModel.getUserInfo.mockResolvedValue({ Name: "No Stall" }); // no StallId

    const req = { user: { userId: "u1" } };
    const res = mockRes();

    await orderController.getDashboard(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "No stall linked to this user",
    });
  });

  it("returns 500 when the model throws", async () => {
    orderModel.getUserInfo.mockRejectedValue(new Error("DB down"));

    const req = { user: { userId: "u1" } };
    const res = mockRes();

    await orderController.getDashboard(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to load dashboard",
    });
  });
});
