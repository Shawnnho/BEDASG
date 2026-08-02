const favItemModel = require("../models/favItemModel");
const sql = require("mssql");
const { poolPromise } = require("../dbConfig");

jest.mock("mssql", () => ({
  NVarChar: jest.fn((len) => `NVarChar(${len ?? ""})`),
  MAX: "MAX",
}));

jest.mock("../dbConfig", () => ({
  poolPromise: Promise.resolve({ request: jest.fn() }),
}));

describe("favItemModel", () => {
  let mockRequest;
  let mockPool;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn(),
    };
    mockPool = await poolPromise;
    mockPool.request.mockReturnValue(mockRequest);
  });

  describe("getFavouriteMenuItems", () => {
    it("should retrieve all favourite menu items for a user", async () => {
      const mockRows = [
        { UserId: "U1", MenuId: "M1", CreatedAt: "2024-01-01" },
        { UserId: "U1", MenuId: "M2", CreatedAt: "2024-01-02" },
      ];
      mockRequest.query.mockResolvedValue({ recordset: mockRows });

      const result = await favItemModel.getFavouriteMenuItems("U1");

      expect(mockPool.request).toHaveBeenCalledTimes(1);
      expect(mockRequest.input).toHaveBeenCalledWith(
        "UserId",
        "NVarChar(255)",
        "U1"
      );
      expect(mockRequest.query).toHaveBeenCalledWith(
        expect.stringContaining("FROM UserFavouriteMenuItems")
      );
      expect(result).toEqual(mockRows);
    });

    it("should return an empty array when user has no favourites", async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] });

      const result = await favItemModel.getFavouriteMenuItems("U_NONE");

      expect(result).toEqual([]);
    });

    it("should handle errors when retrieving favourites", async () => {
      mockRequest.query.mockRejectedValue(new Error("Database Error"));

      await expect(
        favItemModel.getFavouriteMenuItems("U1")
      ).rejects.toThrow("Database Error");
    });
  });

  describe("createFavouriteMenuItem", () => {
    it("should create and return the new favourite row", async () => {
      const mockRow = { UserId: "U1", MenuId: "M1", CreatedAt: "2024-01-01" };
      mockRequest.query.mockResolvedValue({ recordset: [mockRow] });

      const result = await favItemModel.createFavouriteMenuItem("U1", "M1");

      expect(mockRequest.input).toHaveBeenCalledWith(
        "UserId",
        "NVarChar(255)",
        "U1"
      );
      expect(mockRequest.input).toHaveBeenCalledWith(
        "MenuId",
        "NVarChar(255)",
        "M1"
      );
      expect(mockRequest.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO UserFavouriteMenuItems")
      );
      expect(result).toEqual(mockRow);
    });

    it("should propagate a unique constraint violation error", async () => {
      const err = new Error("Violation of UNIQUE KEY constraint");
      err.number = 2627;
      mockRequest.query.mockRejectedValue(err);

      await expect(
        favItemModel.createFavouriteMenuItem("U1", "M1")
      ).rejects.toMatchObject({ number: 2627 });
    });

    it("should propagate a foreign key violation error", async () => {
      const err = new Error("FK constraint violation");
      err.number = 547;
      mockRequest.query.mockRejectedValue(err);

      await expect(
        favItemModel.createFavouriteMenuItem("U1", "BAD_MENU")
      ).rejects.toMatchObject({ number: 547 });
    });
  });

  describe("deleteFavouriteMenuItem", () => {
    it("should return the number of rows deleted", async () => {
      mockRequest.query.mockResolvedValue({ rowsAffected: [1] });

      const result = await favItemModel.deleteFavouriteMenuItem("U1", "M1");

      expect(mockRequest.input).toHaveBeenCalledWith(
        "UserId",
        "NVarChar(255)",
        "U1"
      );
      expect(mockRequest.input).toHaveBeenCalledWith(
        "MenuId",
        "NVarChar(255)",
        "M1"
      );
      expect(mockRequest.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM UserFavouriteMenuItems")
      );
      expect(result).toBe(1);
    });

    it("should return 0 when no matching favourite is found", async () => {
      mockRequest.query.mockResolvedValue({ rowsAffected: [0] });

      const result = await favItemModel.deleteFavouriteMenuItem(
        "U1",
        "NOT_FAVOURITED"
      );

      expect(result).toBe(0);
    });

    it("should handle errors when deleting a favourite", async () => {
      mockRequest.query.mockRejectedValue(new Error("Database Error"));

      await expect(
        favItemModel.deleteFavouriteMenuItem("U1", "M1")
      ).rejects.toThrow("Database Error");
    });
  });

  describe("getFavouriteCounts", () => {
    it("should retrieve like counts for the given menu ids", async () => {
      const mockRows = [
        { MenuId: "1", LikeCount: 4 },
        { MenuId: "2", LikeCount: 0 },
      ];
      mockRequest.query.mockResolvedValue({ recordset: mockRows });

      const result = await favItemModel.getFavouriteCounts(["1", "2", "3"]);

      expect(mockRequest.input).toHaveBeenCalledWith(
        "MenuIds",
        "NVarChar(MAX)",
        "1,2,3"
      );
      expect(mockRequest.query).toHaveBeenCalledWith(
        expect.stringContaining("STRING_SPLIT(@MenuIds, ',')")
      );
      expect(result).toEqual(mockRows);
    });

    it("should return an empty array when none of the menu items have likes", async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] });

      const result = await favItemModel.getFavouriteCounts(["99"]);

      expect(result).toEqual([]);
    });

    it("should handle errors when retrieving favourite counts", async () => {
      mockRequest.query.mockRejectedValue(new Error("Database Error"));

      await expect(
        favItemModel.getFavouriteCounts(["1", "2"])
      ).rejects.toThrow("Database Error");
    });
  });
});