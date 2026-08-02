const menuController = require("../controllers/menuController");
const menuModel = require("../models/menuModel");

jest.mock("../models/menuModel");

describe("menuController.getMenuItems", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should return 400 when stallId param is missing", async () => {
    const req = { params: {} };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await menuController.getMenuItems(req, res);

    expect(menuModel.getMenuItems).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid stall ID" });
  });

  it("should fetch menu items and map fields using primary column names", async () => {
    const mockRows = [
      {
        MenuId: 1,
        ItemId: null,
        Id: null,
        StallId: "S1",
        ItemName: "Chicken Rice",
        Name: null,
        Category: "Rice",
        Desc: "Steamed chicken with rice",
        Description: null,
        ImageUrl: "images/menu/chicken-rice.jpg",
        PriceFrom: null,
        Price: 4.5,
      },
    ];
    menuModel.getMenuItems.mockResolvedValue(mockRows);

    const req = { params: { id: "S1" } };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await menuController.getMenuItems(req, res);

    expect(menuModel.getMenuItems).toHaveBeenCalledWith("S1");
    expect(res.json).toHaveBeenCalledWith([
      {
        id: 1,
        stallId: "S1",
        name: "Chicken Rice",
        category: "Rice",
        desc: "Steamed chicken with rice",
        img: "images/menu/chicken-rice.jpg",
        price: 4.5,
        priceFrom: false,
      },
    ]);
  });

  it("should fall back to ItemId/Id, Name, Description, placeholder image, and PriceFrom when primary fields are missing", async () => {
    const mockRows = [
      {
        MenuId: null,
        ItemId: 7,
        Id: null,
        StallId: "S2",
        ItemName: null,
        Name: "Laksa",
        Category: null,
        Desc: null,
        Description: "Spicy noodle soup",
        ImageUrl: null,
        PriceFrom: 5,
        Price: null,
      },
    ];
    menuModel.getMenuItems.mockResolvedValue(mockRows);

    const req = { params: { id: "S2" } };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await menuController.getMenuItems(req, res);

    expect(res.json).toHaveBeenCalledWith([
      {
        id: 7,
        stallId: "S2",
        name: "Laksa",
        category: "Other",
        desc: "Spicy noodle soup",
        img: "images/menu/placeholder.jpg",
        price: 5,
        priceFrom: true,
      },
    ]);
  });

  it("should use 'Unnamed item' when no name fields are present", async () => {
    const mockRows = [
      {
        MenuId: 3,
        ItemId: null,
        Id: null,
        StallId: "S3",
        ItemName: null,
        Name: null,
        Category: null,
        Desc: null,
        Description: null,
        ImageUrl: null,
        PriceFrom: null,
        Price: 3.2,
      },
    ];
    menuModel.getMenuItems.mockResolvedValue(mockRows);

    const req = { params: { id: "S3" } };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await menuController.getMenuItems(req, res);

    const [result] = res.json.mock.calls[0][0];
    expect(result.name).toBe("Unnamed item");
  });

  it("should handle errors and return a 500 status with error message", async () => {
    const errorMessage = "Database error";
    menuModel.getMenuItems.mockRejectedValue(new Error(errorMessage));

    const req = { params: { id: "S1" } };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await menuController.getMenuItems(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});