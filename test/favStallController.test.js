const favStallModel = require("../models/favStallModel");
const {
  getFavStalls,
  addFavStall,
  deleteFavStall,
} = require("../controllers/favStallController");

jest.mock("../models/favStallModel");

// Helper to build a mock Express response object
function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// Silence console.error noise from the controller's catch blocks
beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("favStallController", () => {
  describe("getFavStalls", () => {
    it("returns 200 with a list of favourite stall IDs", async () => {
      const req = { user: { userId: 1 } };
      const res = mockResponse();
      favStallModel.getFavStalls.mockResolvedValue([
        { StallId: 10 },
        { StallId: 20 },
      ]);

      await getFavStalls(req, res);

      expect(favStallModel.getFavStalls).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ favourites: [10, 20] });
    });

    it("returns 200 with an empty array when the user has no favourites", async () => {
      const req = { user: { userId: 1 } };
      const res = mockResponse();
      favStallModel.getFavStalls.mockResolvedValue([]);

      await getFavStalls(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ favourites: [] });
    });

    it("returns 500 when the model throws", async () => {
      const req = { user: { userId: 1 } };
      const res = mockResponse();
      favStallModel.getFavStalls.mockRejectedValue(new Error("DB error"));

      await getFavStalls(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("addFavStall", () => {
    it("returns 201 with success result on successful insert", async () => {
      const req = { user: { userId: 1 }, body: { stallId: 10 } };
      const res = mockResponse();
      favStallModel.addFavStall.mockResolvedValue(true);

      await addFavStall(req, res);

      expect(favStallModel.addFavStall).toHaveBeenCalledWith(1, 10);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it("returns 409 when the stall is already a favourite (unique violation)", async () => {
      const req = { user: { userId: 1 }, body: { stallId: 10 } };
      const res = mockResponse();
      const uniqueError = new Error("Violation of UNIQUE KEY constraint");
      uniqueError.number = 2627;
      favStallModel.addFavStall.mockRejectedValue(uniqueError);

      await addFavStall(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: "This stall is already a favourite",
      });
    });

    it("returns 500 on a non-unique-violation error", async () => {
      const req = { user: { userId: 1 }, body: { stallId: 10 } };
      const res = mockResponse();
      favStallModel.addFavStall.mockRejectedValue(new Error("DB error"));

      await addFavStall(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("deleteFavStall", () => {
    it("returns 200 with success result on successful delete", async () => {
      const req = { user: { userId: 1 }, body: { stallId: 10 } };
      const res = mockResponse();
      favStallModel.deleteFavStall.mockResolvedValue(true);

      await deleteFavStall(req, res);

      expect(favStallModel.deleteFavStall).toHaveBeenCalledWith(1, 10);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it("returns 500 when the model throws", async () => {
      const req = { user: { userId: 1 }, body: { stallId: 10 } };
      const res = mockResponse();
      favStallModel.deleteFavStall.mockRejectedValue(new Error("DB error"));

      await deleteFavStall(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });
});