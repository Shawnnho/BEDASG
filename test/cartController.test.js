jest.mock("../dbConfig")
jest.mock("../models/cartModel");

const CartModel = require("../models/cartModel");
const {
  getCart,
  updateCart,
  addItem,
  updateItemQty,
  deleteItem,
} = require("../controllers/cartController");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function baseReq(overrides = {}) {
  return {
    user: { userId: "user1" },
    params: { uid: "user1", ...overrides.params },
    body: { ...overrides.body },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Cart Controller", () => {
  describe("getCart", () => {
    test("returns 403 if user tries to access another user's cart", async () => {
      const req = baseReq({ params: { uid: "hacker22" } });
      const res = mockRes();

      await getCart(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "You can only access your own cart",
      });
      expect(CartModel.getCartItems).not.toHaveBeenCalled();
    });

    test("returns 200 and items for a valid request", async () => {
      const fakeItems = [{ cartItemId: 1, name: "Noodles", qty: 2 }];
      CartModel.getCartItems.mockResolvedValue(fakeItems);

      const req = baseReq();
      const res = mockRes();

      await getCart(req, res);

      expect(CartModel.getCartItems).toHaveBeenCalledWith("user1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(fakeItems);
    });

    test("returns 500 if database fails", async () => {
      CartModel.getCartItems.mockRejectedValue(new Error("DB Error"));

      const req = baseReq();
      const res = mockRes();

      await getCart(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Error fetching cart",
        error: "DB Error",
      });
    });
  });

  describe("updateCart", () => {
    test("returns 400 if any item has invalid quantity", async () => {
      const req = baseReq({
        body: { items: [{ qty: 1 }, { qty: -5 }] },
      });
      const res = mockRes();

      await updateCart(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(CartModel.updateCartItems).not.toHaveBeenCalled();
    });

    test("returns 200 on successful update", async () => {
      CartModel.updateCartItems.mockResolvedValue();
      const req = baseReq({
        body: { items: [{ qty: 2 }, { qty: 1 }] },
      });
      const res = mockRes();

      await updateCart(req, res);

      expect(CartModel.updateCartItems).toHaveBeenCalledWith("user1", req.body.items);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Cart updated successfully",
      });
    });
  });

  describe("addItem", () => {
    test("returns 400 if quantity is invalid", async () => {
      const req = baseReq({ body: { qty: 0 } });
      const res = mockRes();

      await addItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(CartModel.addCartItem).not.toHaveBeenCalled();
    });

    test("returns 201 and cartItemId on success", async () => {
      CartModel.addCartItem.mockResolvedValue(99);
      const req = baseReq({ body: { stallId: "s1", qty: 1 } });
      const res = mockRes();

      await addItem(req, res);

      expect(CartModel.addCartItem).toHaveBeenCalledWith("user1", req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, cartItemId: 99 });
    });
  });

  describe("updateItemQty", () => {
    test("returns 400 if quantity is not valid", async () => {
      const req = baseReq({
        params: { cartItemId: "99" },
        body: { qty: "abc" },
      });
      const res = mockRes();

      await updateItemQty(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(CartModel.updateCartItemQty).not.toHaveBeenCalled();
    });

    test("returns 404 if item does not exist or does not belong to user", async () => {
      CartModel.updateCartItemQty.mockResolvedValue(0);
      const req = baseReq({
        params: { cartItemId: "99" },
        body: { qty: 3 },
      });
      const res = mockRes();

      await updateItemQty(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Item not found in your cart",
      });
    });

    test("returns 200 on successful update", async () => {
      CartModel.updateCartItemQty.mockResolvedValue(1);
      const req = baseReq({
        params: { cartItemId: "99" },
        body: { qty: 3 },
      });
      const res = mockRes();

      await updateItemQty(req, res);

      expect(CartModel.updateCartItemQty).toHaveBeenCalledWith("user1", "99", 3);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe("deleteItem", () => {
    test("returns 404 if item not found", async () => {
      CartModel.deleteCartItem.mockResolvedValue(0);
      const req = baseReq({ params: { cartItemId: "99" } });
      const res = mockRes();

      await deleteItem(req, res);

      expect(CartModel.deleteCartItem).toHaveBeenCalledWith("user1", "99");
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("returns 200 on successful deletion", async () => {
      CartModel.deleteCartItem.mockResolvedValue(1);
      const req = baseReq({ params: { cartItemId: "99" } });
      const res = mockRes();

      await deleteItem(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });
});