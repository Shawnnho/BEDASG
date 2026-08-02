const centreModel = require("../models/centreModel");
const dbConfig = require("../dbConfig");

jest.mock("../dbConfig", () => {
  const mockPool = {
    request: jest.fn(),
  };
  return {
    sql: { NVarChar: "NVarChar" },
    poolPromise: Promise.resolve(mockPool),
    __mockPool: mockPool, // exposed so tests can configure request/query behavior
  };
});

describe("centreModel", () => {
  let mockRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn(),
    };
    dbConfig.__mockPool.request.mockReturnValue(mockRequest);
  });

  describe("getAllCentres", () => {
    it("should retrieve all centres from the database", async () => {
      const mockCentres = [
        { CentreId: "C1", Name: "Centre One", ImagePath: "img1.jpg" },
        { CentreId: "C2", Name: "Centre Two", ImagePath: "img2.jpg" },
      ];
      mockRequest.query.mockResolvedValue({ recordset: mockCentres });

      const centres = await centreModel.getAllCentres();

      expect(dbConfig.__mockPool.request).toHaveBeenCalledTimes(1);
      expect(mockRequest.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "SELECT CentreId, Name, ImagePath FROM Centres ORDER BY Name"
        )
      );
      expect(centres).toHaveLength(2);
      expect(centres[0].CentreId).toBe("C1");
      expect(centres[0].Name).toBe("Centre One");
    });

    it("should handle errors when retrieving centres", async () => {
      const errorMessage = "Database Error";
      mockRequest.query.mockRejectedValue(new Error(errorMessage));

      await expect(centreModel.getAllCentres()).rejects.toThrow(errorMessage);
    });
  });

  describe("getCentreById", () => {
    it("should retrieve a centre by id", async () => {
      const mockCentre = {
        CentreId: "C1",
        Name: "Centre One",
        ImagePath: "img1.jpg",
        Location: "Somewhere",
      };
      mockRequest.query.mockResolvedValue({ recordset: [mockCentre] });

      const centre = await centreModel.getCentreById("C1");

      expect(mockRequest.input).toHaveBeenCalledWith(
        "centreId",
        "NVarChar",
        "C1"
      );
      expect(mockRequest.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE CentreId = @centreId")
      );
      expect(centre).toEqual(mockCentre);
    });

    it("should return undefined when centre is not found", async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] });

      const centre = await centreModel.getCentreById("UNKNOWN");

      expect(centre).toBeUndefined();
    });

    it("should handle errors when retrieving a centre by id", async () => {
      const errorMessage = "Database Error";
      mockRequest.query.mockRejectedValue(new Error(errorMessage));

      await expect(centreModel.getCentreById("C1")).rejects.toThrow(
        errorMessage
      );
    });
  });

  describe("getCentresByOperator", () => {
    it("should retrieve centres for a given operator", async () => {
      const mockCentres = [
        { CentreId: "C1", Name: "Centre One", ImagePath: "img1.jpg" },
      ];
      mockRequest.query.mockResolvedValue({ recordset: mockCentres });

      const centres = await centreModel.getCentresByOperator("OP1");

      expect(mockRequest.input).toHaveBeenCalledWith(
        "operatorId",
        "NVarChar",
        "OP1"
      );
      expect(mockRequest.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE OperatorId = @operatorId")
      );
      expect(centres).toHaveLength(1);
      expect(centres[0].CentreId).toBe("C1");
    });

    it("should return an empty array when operator has no centres", async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] });

      const centres = await centreModel.getCentresByOperator("OP_NONE");

      expect(centres).toEqual([]);
    });

    it("should handle errors when retrieving centres by operator", async () => {
      const errorMessage = "Database Error";
      mockRequest.query.mockRejectedValue(new Error(errorMessage));

      await expect(
        centreModel.getCentresByOperator("OP1")
      ).rejects.toThrow(errorMessage);
    });
  });

  describe("getCentreForOperator", () => {
    it("should retrieve a centre owned by the operator", async () => {
      const mockCentre = {
        CentreId: "C1",
        Name: "Centre One",
        ImagePath: "img1.jpg",
      };
      mockRequest.query.mockResolvedValue({ recordset: [mockCentre] });

      const centre = await centreModel.getCentreForOperator("C1", "OP1");

      expect(mockRequest.input).toHaveBeenCalledWith(
        "centreId",
        "NVarChar",
        "C1"
      );
      expect(mockRequest.input).toHaveBeenCalledWith(
        "operatorId",
        "NVarChar",
        "OP1"
      );
      expect(mockRequest.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "WHERE CentreId = @centreId AND OperatorId = @operatorId"
        )
      );
      expect(centre).toEqual(mockCentre);
    });

    it("should return undefined when the centre does not belong to the operator", async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] });

      const centre = await centreModel.getCentreForOperator(
        "C1",
        "OP_WRONG"
      );

      expect(centre).toBeUndefined();
    });

    it("should handle errors when checking centre ownership", async () => {
      const errorMessage = "Database Error";
      mockRequest.query.mockRejectedValue(new Error(errorMessage));

      await expect(
        centreModel.getCentreForOperator("C1", "OP1")
      ).rejects.toThrow(errorMessage);
    });
  });
});