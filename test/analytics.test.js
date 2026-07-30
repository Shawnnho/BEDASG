// tests/analytics.test.js
// Controller tests for stallAnalyticsController.js (Analytics page).
// Mocks stallAnalyticsModel and orderModel (getUserInfo/getStallName).

const analyticsController = require("../controllers/stallAnalyticsController");
const analyticsModel = require("../models/stallAnalyticsModel");
const orderModel = require("../models/orderModel");

jest.mock("../models/stallAnalyticsModel");
jest.mock("../models/orderModel");
jest.mock("../dbConfig", () => ({ poolPromise: Promise.resolve({}), sql: {} }));


function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  // sensible defaults for the model so success paths resolve
  analyticsModel.getKpis.mockResolvedValue({ totalSales: 100, orderCount: 10 });
  analyticsModel.getDailySales.mockResolvedValue([]);
  analyticsModel.getHourlySales.mockResolvedValue([]);
  analyticsModel.getTopDishes.mockResolvedValue([]);
  analyticsModel.getRatings.mockResolvedValue({ avg: 5, total: 3, counts: {} });
  analyticsModel.getHygiene.mockResolvedValue({});
});

describe("stallAnalyticsController.getAnalytics", () => {
  it("returns analytics (200) for the default preset", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1", Name: "Owner" });
    orderModel.getStallName.mockResolvedValue("Kopi-Fellas");

    const req = { user: { userId: "u1" }, query: {} };
    const res = mockRes();
    await analyticsController.getAnalytics(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.stallName).toBe("Kopi-Fellas");
    expect(payload.kpis.totalSales).toBe(100);
    expect(payload.compare).toBeNull(); // compare not requested
    expect(Array.isArray(payload.series)).toBe(true);
  });

  it("includes comparison data when compare=true", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1", Name: "Owner" });
    orderModel.getStallName.mockResolvedValue("Kopi-Fellas");

    const req = {
      user: { userId: "u1" },
      query: { preset: "last7", compare: "true" },
    };
    const res = mockRes();
    await analyticsController.getAnalytics(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.compare).not.toBeNull();
    expect(payload.compare.deltas).toBeDefined();
  });

  it("returns 401 when not authenticated", async () => {
    const req = { user: {}, query: {} };
    const res = mockRes();
    await analyticsController.getAnalytics(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 404 when no stall linked", async () => {
    orderModel.getUserInfo.mockResolvedValue({});
    const req = { user: { userId: "u1" }, query: {} };
    const res = mockRes();
    await analyticsController.getAnalytics(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 500 when the model throws", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1", Name: "Owner" });
    orderModel.getStallName.mockResolvedValue("Kopi-Fellas");
    analyticsModel.getKpis.mockRejectedValue(new Error("DB"));
    const req = { user: { userId: "u1" }, query: {} };
    const res = mockRes();
    await analyticsController.getAnalytics(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});