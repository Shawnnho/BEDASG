jest.mock("../dbConfig");
jest.mock("../models/favouriteOrderModel");

const FavouriteOrderModel = require("../models/favouriteOrderModel");
const {
  getFavourite,
  saveFavourite,
  deleteFavourite,
} = require("../controllers/favouriteOrderController");

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

describe("Favourite Order Controller", () => {
  describe("getFavourite", () => {
    test("returns 403 if user is missing or tries to access another user's favourite", async () => {
      // Test missing user entirely
      let req = baseReq();
      delete req.user;
      let res = mockRes();
      await getFavourite(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "You can only access your own favourite order" });

      // Test mismatched UID
      req = baseReq({ params: { uid: "hacker22" } });
      res = mockRes();
      await getFavourite(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test("returns 200 and the favourite order if it exists", async () => {
      const mockFav = { items: [{ name: "Kopi O" }], updatedAt: "2026-07-30T10:00:00Z" };
      FavouriteOrderModel.getFavourite.mockResolvedValue(mockFav);

      const req = baseReq();
      const res = mockRes();

      await getFavourite(req, res);

      expect(FavouriteOrderModel.getFavourite).toHaveBeenCalledWith("user1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockFav);
    });

    test("returns 200 and an empty default object if no favourite is found", async () => {
      FavouriteOrderModel.getFavourite.mockResolvedValue(null);

      const req = baseReq();
      const res = mockRes();

      await getFavourite(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ items: [], updatedAt: null });
    });

    test("returns 500 when database fails", async () => {
      FavouriteOrderModel.getFavourite.mockRejectedValue(new Error("DB Error"));

      const req = baseReq();
      const res = mockRes();

      await getFavourite(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Error fetching favourite order",
        error: "DB Error",
      });
    });
  });

  describe("saveFavourite", () => {
    test("returns 403 if user tries to save to another account", async () => {
      const req = baseReq({ params: { uid: "hacker22" } });
      const res = mockRes();

      await saveFavourite(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(FavouriteOrderModel.saveFavourite).not.toHaveBeenCalled();
    });

    test("returns 200 on successful save", async () => {
      FavouriteOrderModel.saveFavourite.mockResolvedValue();

      const req = baseReq({ body: { items: [{ name: "Kopi O", qty: 1 }] } });
      const res = mockRes();

      await saveFavourite(req, res);

      expect(FavouriteOrderModel.saveFavourite).toHaveBeenCalledWith("user1", req.body.items);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    test("returns 500 when database fails", async () => {
      FavouriteOrderModel.saveFavourite.mockRejectedValue(new Error("DB Error"));

      const req = baseReq({ body: { items: [] } });
      const res = mockRes();

      await saveFavourite(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Error saving favourite order",
        error: "DB Error",
      });
    });
  });

  describe("deleteFavourite", () => {
    test("returns 403 if user tries to delete another account's favourite", async () => {
      const req = baseReq({ params: { uid: "hacker22" } });
      const res = mockRes();

      await deleteFavourite(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(FavouriteOrderModel.deleteFavourite).not.toHaveBeenCalled();
    });

    test("returns 200 on successful deletion", async () => {
      FavouriteOrderModel.deleteFavourite.mockResolvedValue(1);

      const req = baseReq();
      const res = mockRes();

      await deleteFavourite(req, res);

      expect(FavouriteOrderModel.deleteFavourite).toHaveBeenCalledWith("user1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    test("returns 500 when database fails", async () => {
      FavouriteOrderModel.deleteFavourite.mockRejectedValue(new Error("DB Error"));

      const req = baseReq();
      const res = mockRes();

      await deleteFavourite(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Error deleting favourite order",
        error: "DB Error",
      });
    });
  });
});