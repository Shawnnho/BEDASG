const menuModel = require("../models/menuModel");
const dbConfig = require("../dbConfig");

jest.mock("../dbConfig", () => {
  const mockPool = {
    request: jest.fn(),
  };
  return {
    sql: { VarChar: "VarChar" },
    poolPromise: Promise.resolve(mockPool),
    __mockPool: mockPool,
  };
});

describe("menuModel.getMenuItems", () => {
  let mockRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn(),
    };
    dbConfig.__mockPool.request.mockReturnValue(mockRequest);
  });

  it("should retrieve menu items for a given stall", async () => {
    const mockItems = [
      { MenuId: 1, StallId: "S1", ItemName: "Chicken Rice", Price: 4.5 },
      { MenuId: 2, StallId: "S1", ItemName: "Laksa", Price: 5 },
    ];
    mockRequest.query.mockResolvedValue({ recordset: mockItems });

    const items = await menuModel.getMenuItems("S1");

    expect(dbConfig.__mockPool.request).toHaveBeenCalledTimes(1);
    expect(mockRequest.input).toHaveBeenCalledWith("stallId", "VarChar", "S1");
    expect(mockRequest.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT * FROM StallMenus WHERE StallId = @stallId")
    );
    expect(items).toHaveLength(2);
    expect(items[0].MenuId).toBe(1);
    expect(items[0].ItemName).toBe("Chicken Rice");
  });

  it("should return an empty array when no menu items exist for the stall", async () => {
    mockRequest.query.mockResolvedValue({ recordset: [] });

    const items = await menuModel.getMenuItems("S_NONE");

    expect(items).toEqual([]);
  });

  it("should handle errors when retrieving menu items", async () => {
    const errorMessage = "Database Error";
    mockRequest.query.mockRejectedValue(new Error(errorMessage));

    await expect(menuModel.getMenuItems("S1")).rejects.toThrow(errorMessage);
  });
});