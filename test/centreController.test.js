const centreController = require("../controllers/centreController");
const centreModel = require("../models/centreModel");

jest.mock("../models/centreModel");

describe("centreController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  describe("getCentres", () => {
    it("should fetch all centres and return a mapped JSON response", async () => {
      const mockCentres = [
        { CentreId: "C1", Name: "Centre One", ImagePath: "img1.jpg" },
        { CentreId: "C2", Name: null, ImagePath: null },
      ];
      centreModel.getAllCentres.mockResolvedValue(mockCentres);

      const req = {};
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await centreController.getCentres(req, res);

      expect(centreModel.getAllCentres).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith([
        { centreId: "C1", name: "Centre One", imageUrl: "img1.jpg" },
        {
          centreId: "C2",
          name: "C2",
          imageUrl: "images/default-centre.jpg",
        },
      ]);
    });

    it("should handle errors and return a 500 status with error message", async () => {
      const errorMessage = "Database error";
      centreModel.getAllCentres.mockRejectedValue(new Error(errorMessage));

      const req = {};
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await centreController.getCentres(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Failed to load centres",
      });
    });
  });

  describe("getCentre", () => {
    it("should fetch a centre by id and return it as JSON", async () => {
      const mockCentre = { CentreId: "C1", Name: "Centre One" };
      centreModel.getCentreById.mockResolvedValue(mockCentre);

      const req = { params: { id: "C1" } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await centreController.getCentre(req, res);

      expect(centreModel.getCentreById).toHaveBeenCalledWith("C1");
      expect(res.json).toHaveBeenCalledWith(mockCentre);
    });

    it("should return 404 when the centre is not found", async () => {
      centreModel.getCentreById.mockResolvedValue(undefined);

      const req = { params: { id: "UNKNOWN" } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await centreController.getCentre(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Centre not found" });
    });

    it("should handle errors and return a 500 status with error message", async () => {
      const errorMessage = "Database error";
      centreModel.getCentreById.mockRejectedValue(new Error(errorMessage));

      const req = { params: { id: "C1" } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await centreController.getCentre(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Failed to load centre",
      });
    });
  });
});