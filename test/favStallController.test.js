// booksController.test.js

const favStallController = require("../controllers/favStallController");
const favStallModel = require("../models/favStallModel");

// Mock the Book model
jest.mock("../models/favStallModel"); // Replace with the actual path to your Book model

describe("favStallController.getFavStalls", () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clear mock calls before each test
  });

  it("should fetch the all favourite stalls", async () => {
    const mockFavStalls = [
      { userId: 1, stallId: 1 },
      { userId: 2, stallId : 2 },
    ];

    // Mock the Book.getAllBooks function to return the mock data
    Book.getAllBooks.mockResolvedValue(mockFavStalls);

    const req = {};
    const res = {
      json: jest.fn(), // Mock the res.json function
    };

    await favStallController.getFavStalls(req, res);

    expect(favStallModel.getFavStalls).toHaveBeenCalledTimes(1); // Check if getAllBooks was called
    expect(res.json).toHaveBeenCalledWith(mockFavStalls); // Check the response body
  });

  it("should handle errors and return a 500 status with error message", async () => {
    const errorMessage = "Database error";
    favStallModel.getFavStalls.mockRejectedValue(new Error(errorMessage)); // Simulate an error

    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await favStallController.getFavStalls(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith("Error retrieving favourite stalls");
  });
});