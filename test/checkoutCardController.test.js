jest.mock("../dbConfig");
jest.mock("../models/checkoutCardModel");
jest.mock("../models/cartModel");
jest.mock("../models/stallOwnerLookupModel");
jest.mock("../services/notificationEmails");
jest.mock("qrcode");

const checkoutCardModel = require("../models/checkoutCardModel");
const CartModel = require("../models/cartModel");
const stallOwnerLookupModel = require("../models/stallOwnerLookupModel");
const { sendOrderConfirmation, sendNewOrderAlert } = require("../services/notificationEmails");
const QRCode = require("qrcode");

const {
  createCheckout,
  getCheckout,
  payCheckout,
  getCheckoutQr,
} = require("../controllers/checkoutCardController");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
}

function baseReq(overrides = {}) {
  return {
    user: { userId: "user1" },
    params: { ...overrides.params },
    body: { ...overrides.body },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Checkout Card Controller", () => {
  describe("createCheckout", () => {
    test("returns 201 and creates checkout for logged-in user", async () => {
      checkoutCardModel.createCheckoutOrder.mockResolvedValue({
        checkoutId: "CO_123",
        primaryOrderId: "OD_1",
        orderIds: ["OD_1"],
      });

      const req = baseReq({ body: { fulfillment: "pickup" } });
      const res = mockRes();

      await createCheckout(req, res);

      expect(checkoutCardModel.createCheckoutOrder).toHaveBeenCalledWith({
        fulfillment: "pickup",
        userId: "user1",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        checkoutId: "CO_123",
        orderId: "OD_1",
        orderIds: ["OD_1"],
      });
    });

    test("defaults userId to 'guest' if user is not authenticated", async () => {
      checkoutCardModel.createCheckoutOrder.mockResolvedValue({
        checkoutId: "CO_999",
      });

      const req = baseReq();
      delete req.user;
      const res = mockRes();

      await createCheckout(req, res);

      expect(checkoutCardModel.createCheckoutOrder).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "guest" })
      );
    });

    test("returns 500 when database fails", async () => {
      checkoutCardModel.createCheckoutOrder.mockRejectedValue(new Error("DB Error"));
      const req = baseReq();
      const res = mockRes();

      await createCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to create order" });
    });
  });

  describe("getCheckout", () => {
    test("returns 404 if checkout is not found", async () => {
      checkoutCardModel.getCheckoutSummary.mockResolvedValue(null);
      const req = baseReq({ params: { checkoutId: "CO_123" } });
      const res = mockRes();

      await getCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("returns 403 if user tries to view someone else's checkout", async () => {
      checkoutCardModel.getCheckoutSummary.mockResolvedValue({
        checkout: { UserId: "another_user" },
      });
      const req = baseReq({ params: { checkoutId: "CO_123" } });
      const res = mockRes();

      await getCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test("returns 200 and summary if authorized", async () => {
      const summary = { checkout: { UserId: "user1" }, orders: [] };
      checkoutCardModel.getCheckoutSummary.mockResolvedValue(summary);
      const req = baseReq({ params: { checkoutId: "CO_123" } });
      const res = mockRes();

      await getCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(summary);
    });
  });

  describe("payCheckout", () => {
    test("returns 404 if checkout is not found initially", async () => {
      checkoutCardModel.getCheckoutSummary.mockResolvedValue(null);
      const req = baseReq({ params: { checkoutId: "CO_123" } });
      const res = mockRes();

      await payCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("returns 403 if user tries to pay someone else's checkout", async () => {
      checkoutCardModel.getCheckoutSummary.mockResolvedValue({
        checkout: { UserId: "another_user" },
      });
      const req = baseReq({ params: { checkoutId: "CO_123" } });
      const res = mockRes();

      await payCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test("processes payment, clears cart, sends emails, and returns 200", async () => {
      const mockSummary = {
        checkout: { UserId: "user1" },
        orders: [
          { OrderId: "OD_1", OrderNo: "ORD-1", StallId: "S1", CustomerEmail: "test@test.com" }
        ],
        items: []
      };
      checkoutCardModel.getCheckoutSummary.mockResolvedValue(mockSummary);
      checkoutCardModel.markPaid.mockResolvedValue(mockSummary);
      stallOwnerLookupModel.getStallOwnerEmail.mockResolvedValue("owner@stall.com");
      sendOrderConfirmation.mockResolvedValue();
      sendNewOrderAlert.mockResolvedValue();

      const req = baseReq({
        params: { checkoutId: "CO_123" },
        body: { paymentRef: "PAY_1" }
      });
      const res = mockRes();

      await payCheckout(req, res);

      // Verify payment was marked
      expect(checkoutCardModel.markPaid).toHaveBeenCalledWith({
        id: "CO_123",
        paymentRef: "PAY_1"
      });

      // Verify cart was cleared for the registered user
      expect(CartModel.updateCartItems).toHaveBeenCalledWith("user1", []);

      // Wait a tick for floating promises (emails) to resolve
      await new Promise(process.nextTick);

      expect(sendOrderConfirmation).toHaveBeenCalled();
      expect(sendNewOrderAlert).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, ...mockSummary });
    });

    test("skips clearing cart if user is a guest", async () => {
      const mockSummary = {
        checkout: { UserId: null }, // Guest
        orders: [{ CustomerId: "guest" }]
      };
      checkoutCardModel.getCheckoutSummary.mockResolvedValue(mockSummary);
      checkoutCardModel.markPaid.mockResolvedValue(mockSummary);

      const req = baseReq({ params: { checkoutId: "CO_123" } });
      delete req.user; 
      const res = mockRes();

      await payCheckout(req, res);

      expect(CartModel.updateCartItems).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getCheckoutQr", () => {
    test("returns 404 if checkout has no orders", async () => {
      checkoutCardModel.getCheckoutSummary.mockResolvedValue({ orders: [] });
      const req = baseReq({ params: { checkoutId: "CO_123" } });
      const res = mockRes();

      await getCheckoutQr(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("streams QR code as PNG image successfully", async () => {
      const mockSummary = {
        checkout: { UserId: "user1" },
        orders: [{ OrderNo: "ORD-123" }]
      };
      checkoutCardModel.getCheckoutSummary.mockResolvedValue(mockSummary);
      QRCode.toFileStream.mockResolvedValue();

      const req = baseReq({ params: { checkoutId: "CO_123" } });
      const res = mockRes();

      await getCheckoutQr(req, res);

      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/png");
      expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
      expect(QRCode.toFileStream).toHaveBeenCalledWith(res, "ORD-123", {
        type: "png",
        width: 300,
        margin: 1,
      });
    });

    test("returns 500 when QR generation fails", async () => {
      checkoutCardModel.getCheckoutSummary.mockRejectedValue(new Error("DB Error"));
      const req = baseReq({ params: { checkoutId: "CO_123" } });
      const res = mockRes();

      await getCheckoutQr(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to generate QR code" });
    });
  });
});