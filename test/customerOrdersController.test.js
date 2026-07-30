jest.mock("../dbConfig");
jest.mock("../models/customerOrdersModel");

const customerOrdersModel = require("../models/customerOrdersModel");
const {
  getMyOrders,
  deleteMyOrder,
  cancelMyOrder,
} = require("../controllers/customerOrdersController");

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
    query: { ...overrides.query },
    body: { ...overrides.body },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Customer Orders Controller", () => {
  describe("getMyOrders", () => {
    test("returns 401 if user is not authenticated", async () => {
      const req = baseReq();
      delete req.user;
      const res = mockRes();

      await getMyOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Not authenticated" });
    });

    test("returns 200 and properly shapes the orders and items", async () => {
      const mockOrderRow = {
        OrderId: "order_1",
        OrderNo: "ORD-001",
        StallName: "Chicken Stall",
        OrderStatus: "pending",
        CheckoutId: "checkout_1",
        PaymentMethod: "card",
        TotalAmount: 15.5,
        FulfillmentType: "pickup",
        CreatedAt: "2026-07-30T10:00:00Z",
      };

      const mockItemRow = {
        OrderId: "order_1",
        StallId: "stall_1",
        ItemId: "item_1",
        ItemName: "Chicken Rice",
        ImageUrl: "chicken.png",
        Quantity: 2,
        UnitPrice: 7.75,
        LineTotal: 15.5,
        VariantKey: null,
        VariantLabel: null,
        ItemNote: "Extra chili",
        AddonsJson: null,
        RequiredModifiersJson: null,
      };

      customerOrdersModel.getOrdersForCustomer.mockResolvedValue([mockOrderRow]);
      customerOrdersModel.getItemsForOrderIds.mockResolvedValue([mockItemRow]);

      const req = baseReq({ query: { checkoutId: "checkout_1" } });
      const res = mockRes();

      await getMyOrders(req, res);

      expect(customerOrdersModel.getOrdersForCustomer).toHaveBeenCalledWith(
        "user1",
        "checkout_1"
      );
      expect(customerOrdersModel.getItemsForOrderIds).toHaveBeenCalledWith([
        "order_1",
      ]);
      expect(res.json).toHaveBeenCalledWith({
        orders: [
          {
            id: "order_1",
            orderNo: "ORD-001",
            stallName: "Chicken Stall",
            status: "pending",
            checkoutId: "checkout_1",
            payment: { method: "card" },
            pricing: { total: 15.5 },
            fulfillment: { type: "pickup" },
            createdAt: "2026-07-30T10:00:00Z",
            items: [
              {
                stallId: "stall_1",
                itemId: "item_1",
                name: "Chicken Rice",
                img: "chicken.png",
                qty: 2,
                unitPrice: 7.75,
                totalPrice: 15.5,
                variantKey: null,
                variantLabel: null,
                note: "Extra chili",
                addons: [],
                required: [],
              },
            ],
          },
        ],
      });
    });

    test("returns 500 when database fails", async () => {
      customerOrdersModel.getOrdersForCustomer.mockRejectedValue(
        new Error("DB Error")
      );

      const req = baseReq();
      const res = mockRes();

      await getMyOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to load orders" });
    });
  });

  describe("deleteMyOrder", () => {
    test("returns 401 if user is not authenticated", async () => {
      const req = baseReq({ params: { id: "order_1" } });
      delete req.user;
      const res = mockRes();

      await deleteMyOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test("returns 404 if order is not found or deleted count is 0", async () => {
      customerOrdersModel.deleteOrdersForCustomer.mockResolvedValue(0);

      const req = baseReq({ params: { id: "order_1" } });
      const res = mockRes();

      await deleteMyOrder(req, res);

      expect(customerOrdersModel.deleteOrdersForCustomer).toHaveBeenCalledWith(
        "user1",
        "order_1"
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Order not found" });
    });

    test("returns 200 on successful deletion", async () => {
      customerOrdersModel.deleteOrdersForCustomer.mockResolvedValue(1);

      const req = baseReq({ params: { id: "order_1" } });
      const res = mockRes();

      await deleteMyOrder(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, deletedCount: 1 });
    });

    test("returns 500 when database fails", async () => {
      customerOrdersModel.deleteOrdersForCustomer.mockRejectedValue(
        new Error("DB Error")
      );

      const req = baseReq({ params: { id: "order_1" } });
      const res = mockRes();

      await deleteMyOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Failed to delete order",
      });
    });
  });

  describe("cancelMyOrder", () => {
    test("returns 401 if user is not authenticated", async () => {
      const req = baseReq({ params: { id: "order_1" } });
      delete req.user;
      const res = mockRes();

      await cancelMyOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test("returns 409 if order is not found, not owned, or already completed", async () => {
      customerOrdersModel.cancelOrder.mockResolvedValue(0);

      const req = baseReq({ params: { id: "order_1" } });
      const res = mockRes();

      await cancelMyOrder(req, res);

      expect(customerOrdersModel.cancelOrder).toHaveBeenCalledWith(
        "user1",
        "order_1"
      );
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: "Order not found, not yours, or already completed/cancelled",
      });
    });

    test("returns 200 on successful cancellation", async () => {
      customerOrdersModel.cancelOrder.mockResolvedValue(1);

      const req = baseReq({ params: { id: "order_1" } });
      const res = mockRes();

      await cancelMyOrder(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        cancelledCount: 1,
      });
    });

    test("returns 500 when database fails", async () => {
      customerOrdersModel.cancelOrder.mockRejectedValue(new Error("DB Error"));

      const req = baseReq({ params: { id: "order_1" } });
      const res = mockRes();

      await cancelMyOrder(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Failed to cancel order",
      });
    });
  });
});