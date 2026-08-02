const favItemController = require("../controllers/favItemController");
const favItemModel = require("../models/favItemModel");

jest.mock("../models/favItemModel");

describe("favItemController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  describe("getFavouriteItems", () => {
    it("should fetch favourites for the authenticated user and return 200", async () => {
      const mockFavourites = [{ UserId: "U1", MenuId: "M1" }];
      favItemModel.getFavouriteMenuItems.mockResolvedValue(mockFavourites);

      const req = { user: { userId: "U1" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await favItemController.getFavouriteItems(req, res);

      expect(favItemModel.getFavouriteMenuItems).toHaveBeenCalledWith("U1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockFavourites);
    });

    it("should return 500 when fetching favourites fails", async () => {
      favItemModel.getFavouriteMenuItems.mockRejectedValue(
        new Error("Database error")
      );

      const req = { user: { userId: "U1" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await favItemController.getFavouriteItems(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to fetch favourite menu items",
      });
    });
  });

  describe("createFavouriteItem", () => {
    it("should create a favourite and return 201", async () => {
      const mockFavourite = { UserId: "U1", MenuId: "M1" };
      favItemModel.createFavouriteMenuItem.mockResolvedValue(mockFavourite);

      const req = { user: { userId: "U1" }, query: { menuId: "M1" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await favItemController.createFavouriteItem(req, res);

      expect(favItemModel.createFavouriteMenuItem).toHaveBeenCalledWith(
        "U1",
        "M1"
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockFavourite);
    });

    it("should return 400 when menuId is missing", async () => {
      const req = { user: { userId: "U1" }, query: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await favItemController.createFavouriteItem(req, res);

      expect(favItemModel.createFavouriteMenuItem).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "menuId is required" });
    });

    it("should return 409 when the favourite already exists", async () => {
      const err = new Error("Violation of UNIQUE KEY constraint");
      err.number = 2627;
      favItemModel.createFavouriteMenuItem.mockRejectedValue(err);

      const req = { user: { userId: "U1" }, query: { menuId: "M1" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await favItemController.createFavouriteItem(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: "This item is already a favourite",
      });
    });

    it("should return 400 when userId or menuId is invalid (FK violation)", async () => {
      const err = new Error("FK constraint violation");
      err.number = 547;
      favItemModel.createFavouriteMenuItem.mockRejectedValue(err);

      const req = { user: { userId: "U1" }, query: { menuId: "BAD" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await favItemController.createFavouriteItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid userId or menuId",
      });
    });

    it("should return 500 for unexpected errors", async () => {
      favItemModel.createFavouriteMenuItem.mockRejectedValue(
        new Error("Database error")
      );

      const req = { user: { userId: "U1" }, query: { menuId: "M1" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await favItemController.createFavouriteItem(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to create favourite menu item",
      });
    });
  });

  describe("deleteFavouriteItem", () => {
    it("should delete a favourite and return 200", async () => {
      favItemModel.deleteFavouriteMenuItem.mockResolvedValue(1);

      const req = { user: { userId: "U1" }, query: { menuId: "M1" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await favItemController.deleteFavouriteItem(req, res);

      expect(favItemModel.deleteFavouriteMenuItem).toHaveBeenCalledWith(
        "U1",
        "M1"
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Favourite menu item deleted",
      });
    });

    it("should return 400 when menuId is missing", async () => {
      const req = { user: { userId: "U1" }, query: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await favItemController.deleteFavouriteItem(req, res);

      expect(favItemModel.deleteFavouriteMenuItem).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "menuId is required" });
    });

    it("should return 404 when no matching favourite is found", async () => {
      favItemModel.deleteFavouriteMenuItem.mockResolvedValue(0);

      const req = {
        user: { userId: "U1" },
        query: { menuId: "NOT_FAVOURITED" },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await favItemController.deleteFavouriteItem(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Favourite menu item not found",
      });
    });

    it("should return 500 when deletion fails", async () => {
      favItemModel.deleteFavouriteMenuItem.mockRejectedValue(
        new Error("Database error")
      );

      const req = { user: { userId: "U1" }, query: { menuId: "M1" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await favItemController.deleteFavouriteItem(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to delete favourite menu item",
      });
    });
  });

  describe("getFavouriteCounts", () => {
    it("should fetch counts for a comma-separated list of menuIds", async () => {
      const mockCounts = [
        { MenuId: "1", LikeCount: 4 },
        { MenuId: "2", LikeCount: 0 },
      ];
      favItemModel.getFavouriteCounts.mockResolvedValue(mockCounts);

      const req = { query: { menuIds: "1, 2, 3" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await favItemController.getFavouriteCounts(req, res);

      expect(favItemModel.getFavouriteCounts).toHaveBeenCalledWith([
        "1",
        "2",
        "3",
      ]);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockCounts);
    });

    it("should return 400 when menuIds is missing", async () => {
      const req = { query: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await favItemController.getFavouriteCounts(req, res);

      expect(favItemModel.getFavouriteCounts).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "menuIds query param is required (comma-separated)",
      });
    });

    it("should return 400 when menuIds resolves to an empty list", async () => {
      const req = { query: { menuIds: " , , " } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await favItemController.getFavouriteCounts(req, res);

      expect(favItemModel.getFavouriteCounts).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "menuIds must contain at least one id",
      });
    });

    it("should return 500 when fetching counts fails", async () => {
      favItemModel.getFavouriteCounts.mockRejectedValue(
        new Error("Database error")
      );

      const req = { query: { menuIds: "1,2" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await favItemController.getFavouriteCounts(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to fetch favourite counts",
      });
    });
  });
});