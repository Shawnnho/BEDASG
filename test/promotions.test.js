// tests/promotions.test.js
// Controller tests for promotionController.js (the Promotions page + customer redeem).
// Covers getPromotions, redeemPromotion, getMyPromotions, createPromotion,
// updatePromotion, deletePromotion. Mocks BOTH models it depends on.

const promoController = require("../controllers/promotionController");
const promoModel = require("../models/promotionModel");
const orderModel = require("../models/orderModel"); // used for getUserInfo

jest.mock("../models/promotionModel");
jest.mock("../models/orderModel");
jest.mock("../dbConfig", () => ({ poolPromise: Promise.resolve({}), sql: {} }));

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// A fully-valid promo body so Joi validation passes on success-path tests.
function validPromo(overrides = {}) {
  return {
    promoTitle: "Lunch Deal",
    promoCode: "LUNCH10",
    desc: "10% off lunch",
    promoType: "percentage",
    discountValue: 10,
    minSpend: 5,
    maxDiscount: 3,
    redemptionsLeft: 100,
    expiresAt: "2026-12-31T00:00:00.000Z",
    claimOnce: true,
    isPopular: false,
    requiredKeyword: "",
    imageUrl: "",
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

/* ===================== getPromotions (public) ===================== */
describe("promotionController.getPromotions", () => {
  it("returns all promotions (200)", async () => {
    promoModel.getAllPromotions.mockResolvedValue([{ id: "p1" }]);
    const req = {};
    const res = mockRes();
    await promoController.getPromotions(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: "p1" }]);
  });

  it("returns 500 on model error", async () => {
    promoModel.getAllPromotions.mockRejectedValue(new Error("DB"));
    const req = {};
    const res = mockRes();
    await promoController.getPromotions(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ===================== redeemPromotion ===================== */
describe("promotionController.redeemPromotion", () => {
  it("redeems successfully (200)", async () => {
    promoModel.redeemPromotion.mockResolvedValue({ success: true });
    const req = { user: { userId: "u1" }, body: { code: "LUNCH10" } };
    const res = mockRes();
    await promoController.redeemPromotion(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 401 when not logged in", async () => {
    const req = { user: {}, body: { code: "LUNCH10" } };
    const res = mockRes();
    await promoController.redeemPromotion(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when code missing", async () => {
    const req = { user: { userId: "u1" }, body: {} };
    const res = mockRes();
    await promoController.redeemPromotion(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 409 when already claimed", async () => {
    promoModel.redeemPromotion.mockResolvedValue({
      success: false,
      reason: "already_claimed",
    });
    const req = { user: { userId: "u1" }, body: { code: "LUNCH10" } };
    const res = mockRes();
    await promoController.redeemPromotion(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("returns 400 when exhausted", async () => {
    promoModel.redeemPromotion.mockResolvedValue({
      success: false,
      reason: "exhausted",
    });
    const req = { user: { userId: "u1" }, body: { code: "LUNCH10" } };
    const res = mockRes();
    await promoController.redeemPromotion(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when expired", async () => {
    promoModel.redeemPromotion.mockResolvedValue({
      success: false,
      reason: "expired",
    });
    const req = { user: { userId: "u1" }, body: { code: "LUNCH10" } };
    const res = mockRes();
    await promoController.redeemPromotion(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ===================== getMyPromotions ===================== */
describe("promotionController.getMyPromotions", () => {
  it("returns this stall's promos (200)", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    promoModel.getPromotionsByStall.mockResolvedValue([{ id: "p1" }]);
    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await promoController.getMyPromotions(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: "p1" }]);
  });

  it("returns 401 when not authenticated", async () => {
    const req = { user: {} };
    const res = mockRes();
    await promoController.getMyPromotions(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 404 when no stall linked", async () => {
    orderModel.getUserInfo.mockResolvedValue({});
    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await promoController.getMyPromotions(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ===================== createPromotion ===================== */
describe("promotionController.createPromotion", () => {
  it("creates a promotion (201) with valid data", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    promoModel.addPromotion.mockResolvedValue("newPromoId");
    const req = { user: { userId: "u1" }, body: validPromo() };
    const res = mockRes();
    await promoController.createPromotion(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].promotionId).toBe("newPromoId");
  });

  it("returns 400 when validation fails (missing title)", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    const req = {
      user: { userId: "u1" },
      body: validPromo({ promoTitle: undefined }),
    };
    const res = mockRes();
    await promoController.createPromotion(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(promoModel.addPromotion).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid promo type", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    const req = {
      user: { userId: "u1" },
      body: validPromo({ promoType: "bogus" }),
    };
    const res = mockRes();
    await promoController.createPromotion(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 401 when not authenticated", async () => {
    const req = { user: {}, body: validPromo() };
    const res = mockRes();
    await promoController.createPromotion(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

/* ===================== updatePromotion ===================== */
describe("promotionController.updatePromotion", () => {
  it("updates a promotion (200)", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    promoModel.updatePromotion.mockResolvedValue(1);
    const req = {
      user: { userId: "u1" },
      params: { id: "p1" },
      body: validPromo(),
    };
    const res = mockRes();
    await promoController.updatePromotion(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 404 when the promo doesn't exist / not this stall's", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    promoModel.updatePromotion.mockResolvedValue(0);
    const req = {
      user: { userId: "u1" },
      params: { id: "p1" },
      body: validPromo(),
    };
    const res = mockRes();
    await promoController.updatePromotion(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 400 on invalid body", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    const req = {
      user: { userId: "u1" },
      params: { id: "p1" },
      body: validPromo({ discountValue: -5 }),
    };
    const res = mockRes();
    await promoController.updatePromotion(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ===================== deletePromotion ===================== */
describe("promotionController.deletePromotion", () => {
  it("deletes a promotion (200)", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    promoModel.deletePromotion.mockResolvedValue(1);
    const req = { user: { userId: "u1" }, params: { id: "p1" } };
    const res = mockRes();
    await promoController.deletePromotion(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 404 when nothing was deleted", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    promoModel.deletePromotion.mockResolvedValue(0);
    const req = { user: { userId: "u1" }, params: { id: "p1" } };
    const res = mockRes();
    await promoController.deletePromotion(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 404 when no stall linked", async () => {
    orderModel.getUserInfo.mockResolvedValue({});
    const req = { user: { userId: "u1" }, params: { id: "p1" } };
    const res = mockRes();
    await promoController.deletePromotion(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
