jest.mock("../dbConfig");
jest.mock("../models/promotionModel");
jest.mock("../models/orderModel");

const promoModel = require("../models/promotionModel");
const orderModel = require("../models/orderModel");
const {
  getPromotions,
  redeemPromotion,
  getMyPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
} = require("../controllers/promotionController");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function baseReq(overrides = {}) {
  return {
    user: { userId: "user1" },
    params: { ...overrides.params },
    body: { ...overrides.body },
  };
}

const validPromoPayload = {
  promoTitle: "Test Promo",
  promoCode: "TEST20",
  promoType: "percentage",
  discountValue: 20,
  minSpend: 15,
  redemptionsLeft: 50,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Promotion Controller", () => {
  describe("getPromotions", () => {
    test("returns 200 and all promotions", async () => {
      const mockPromos = [{ PromoCode: "SAVE10" }];
      promoModel.getAllPromotions.mockResolvedValue(mockPromos);
      const req = baseReq();
      const res = mockRes();

      await getPromotions(req, res);

      expect(promoModel.getAllPromotions).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockPromos);
    });

    test("returns 500 when database fails", async () => {
      promoModel.getAllPromotions.mockRejectedValue(new Error("DB Error"));
      const req = baseReq();
      const res = mockRes();

      await getPromotions(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to fetch promotions" });
    });
  });

  describe("redeemPromotion", () => {
    test("returns 401 if user is not authenticated", async () => {
      const req = baseReq({ body: { code: "SAVE10" } });
      delete req.user;
      const res = mockRes();

      await redeemPromotion(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "You must be logged in to redeem a promo code" });
    });

    test("returns 400 if promo code is missing", async () => {
      const req = baseReq({ body: {} });
      const res = mockRes();

      await redeemPromotion(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Promo code is required" });
    });

    test("returns 200 on successful redemption", async () => {
      promoModel.redeemPromotion.mockResolvedValue({ success: true });
      const req = baseReq({ body: { code: "SAVE10" } });
      const res = mockRes();

      await redeemPromotion(req, res);

      expect(promoModel.redeemPromotion).toHaveBeenCalledWith("SAVE10", "user1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Promotion redeemed successfully" });
    });

    test("returns 409 if already claimed", async () => {
      promoModel.redeemPromotion.mockResolvedValue({ success: false, reason: "already_claimed" });
      const req = baseReq({ body: { code: "SAVE10" } });
      const res = mockRes();

      await redeemPromotion(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: "You've already claimed this promo code" });
    });

    test("returns 400 if exhausted", async () => {
      promoModel.redeemPromotion.mockResolvedValue({ success: false, reason: "exhausted" });
      const req = baseReq({ body: { code: "SAVE10" } });
      const res = mockRes();

      await redeemPromotion(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "This promo code has no redemptions left" });
    });

    test("returns 400 if expired", async () => {
      promoModel.redeemPromotion.mockResolvedValue({ success: false, reason: "expired" });
      const req = baseReq({ body: { code: "SAVE10" } });
      const res = mockRes();

      await redeemPromotion(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "This promo code has expired" });
    });

    test("returns 400 for any other invalid state", async () => {
      promoModel.redeemPromotion.mockResolvedValue({ success: false, reason: "not_found" });
      const req = baseReq({ body: { code: "SAVE10" } });
      const res = mockRes();

      await redeemPromotion(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid promo code" });
    });

    test("returns 500 when database fails", async () => {
      promoModel.redeemPromotion.mockRejectedValue(new Error("DB Error"));
      const req = baseReq({ body: { code: "SAVE10" } });
      const res = mockRes();

      await redeemPromotion(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to redeem promotion" });
    });
  });

  describe("getMyPromotions", () => {
    test("returns 401 if user is not authenticated", async () => {
      const req = baseReq();
      delete req.user;
      const res = mockRes();

      await getMyPromotions(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Not authenticated" });
    });

    test("returns 404 if no stall is linked to user", async () => {
      orderModel.getUserInfo.mockResolvedValue({ Name: "Test" });
      const req = baseReq();
      const res = mockRes();

      await getMyPromotions(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "No stall linked to this user" });
    });

    test("returns 200 and stall promotions", async () => {
      orderModel.getUserInfo.mockResolvedValue({ StallId: "stall_1", Name: "Test" });
      const mockPromos = [{ PromoCode: "STALL10" }];
      promoModel.getPromotionsByStall.mockResolvedValue(mockPromos);
      const req = baseReq();
      const res = mockRes();

      await getMyPromotions(req, res);

      expect(promoModel.getPromotionsByStall).toHaveBeenCalledWith("stall_1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockPromos);
    });

    test("returns 500 when database fails", async () => {
      orderModel.getUserInfo.mockResolvedValue({ StallId: "stall_1", Name: "Test" });
      promoModel.getPromotionsByStall.mockRejectedValue(new Error("DB Error"));
      const req = baseReq();
      const res = mockRes();

      await getMyPromotions(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to fetch your promotions." });
    });
  });

  describe("createPromotion", () => {
    test("returns 400 if validation fails", async () => {
      orderModel.getUserInfo.mockResolvedValue({ StallId: "stall_1", Name: "Test" });
      const req = baseReq({ body: { promoTitle: "A" } }); 
      const res = mockRes();

      await createPromotion(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(promoModel.addPromotion).not.toHaveBeenCalled();
    });

    test("returns 201 on successful creation", async () => {
      orderModel.getUserInfo.mockResolvedValue({ StallId: "stall_1", Name: "Test" });
      promoModel.addPromotion.mockResolvedValue("p1");
      const req = baseReq({ body: validPromoPayload });
      const res = mockRes();

      await createPromotion(req, res);

      expect(promoModel.addPromotion).toHaveBeenCalledWith("stall_1", expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: "Promotion created.", promotionId: "p1" });
    });

    test("returns 500 when database fails", async () => {
      orderModel.getUserInfo.mockResolvedValue({ StallId: "stall_1", Name: "Test" });
      promoModel.addPromotion.mockRejectedValue(new Error("DB Error"));
      const req = baseReq({ body: validPromoPayload });
      const res = mockRes();

      await createPromotion(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to create promotion." });
    });
  });

  describe("updatePromotion", () => {
    test("returns 400 if promotionId is missing", async () => {
      orderModel.getUserInfo.mockResolvedValue({ StallId: "stall_1", Name: "Test" });
      const req = baseReq({ params: { id: "" }, body: validPromoPayload });
      const res = mockRes();

      await updatePromotion(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid promotion id." });
    });

    test("returns 400 if validation fails", async () => {
      orderModel.getUserInfo.mockResolvedValue({ StallId: "stall_1", Name: "Test" });
      const req = baseReq({ params: { id: "p1" }, body: { promoType: "invalid_type" } });
      const res = mockRes();

      await updatePromotion(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(promoModel.updatePromotion).not.toHaveBeenCalled();
    });

    test("returns 404 if promotion is not found or not owned", async () => {
      orderModel.getUserInfo.mockResolvedValue({ StallId: "stall_1", Name: "Test" });
      promoModel.updatePromotion.mockResolvedValue(0);
      const req = baseReq({ params: { id: "p1" }, body: validPromoPayload });
      const res = mockRes();

      await updatePromotion(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Promotion not found." });
    });

    test("returns 200 on successful update", async () => {
      orderModel.getUserInfo.mockResolvedValue({ StallId: "stall_1", Name: "Test" });
      promoModel.updatePromotion.mockResolvedValue(1);
      const req = baseReq({ params: { id: "p1" }, body: validPromoPayload });
      const res = mockRes();

      await updatePromotion(req, res);

      expect(promoModel.updatePromotion).toHaveBeenCalledWith("p1", "stall_1", expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Promotion updated." });
    });

    test("returns 500 when database fails", async () => {
      orderModel.getUserInfo.mockResolvedValue({ StallId: "stall_1", Name: "Test" });
      promoModel.updatePromotion.mockRejectedValue(new Error("DB Error"));
      const req = baseReq({ params: { id: "p1" }, body: validPromoPayload });
      const res = mockRes();

      await updatePromotion(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to update promotion." });
    });
  });

  describe("deletePromotion", () => {
    test("returns 400 if promotionId is missing", async () => {
      orderModel.getUserInfo.mockResolvedValue({ StallId: "stall_1", Name: "Test" });
      const req = baseReq({ params: { id: "" } });
      const res = mockRes();

      await deletePromotion(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid promotion id." });
    });

    test("returns 404 if promotion is not found or not owned", async () => {
      orderModel.getUserInfo.mockResolvedValue({ StallId: "stall_1", Name: "Test" });
      promoModel.deletePromotion.mockResolvedValue(0);
      const req = baseReq({ params: { id: "p1" } });
      const res = mockRes();

      await deletePromotion(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Promotion not found." });
    });

    test("returns 200 on successful deletion", async () => {
      orderModel.getUserInfo.mockResolvedValue({ StallId: "stall_1", Name: "Test" });
      promoModel.deletePromotion.mockResolvedValue(1);
      const req = baseReq({ params: { id: "p1" } });
      const res = mockRes();

      await deletePromotion(req, res);

      expect(promoModel.deletePromotion).toHaveBeenCalledWith("p1", "stall_1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Promotion deleted." });
    });

    test("returns 500 when database fails", async () => {
      orderModel.getUserInfo.mockResolvedValue({ StallId: "stall_1", Name: "Test" });
      promoModel.deletePromotion.mockRejectedValue(new Error("DB Error"));
      const req = baseReq({ params: { id: "p1" } });
      const res = mockRes();

      await deletePromotion(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to delete promotion." });
    });
  });
});