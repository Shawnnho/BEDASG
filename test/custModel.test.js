const custModel = require("../models/custModel");

jest.mock("../dbConfig", () => {
  const mockPool = {
    request: jest.fn(),
  };
  return {
    sql: {
      NVarChar: jest.fn((len) => `NVarChar(${len ?? ""})`),
      MAX: "MAX",
    },
    poolPromise: Promise.resolve(mockPool),
    __mockPool: mockPool,
  };
});

const dbConfig = require("../dbConfig");

describe("custModel", () => {
  let mockRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn(),
    };
    dbConfig.__mockPool.request.mockReturnValue(mockRequest);
  });

  describe("getCustomer", () => {
    it("should retrieve a customer by userId", async () => {
      const mockRows = [
        { UserId: "U1", Name: "Alice", Email: "alice@example.com" },
      ];
      mockRequest.query.mockResolvedValue({ recordset: mockRows });

      const result = await custModel.getCustomer("U1");

      expect(mockRequest.input).toHaveBeenCalledWith(
        "UserId",
        "NVarChar(255)",
        "U1"
      );
      expect(mockRequest.query).toHaveBeenCalledWith(
        expect.stringContaining("FROM Users WHERE UserId = @UserId")
      );
      expect(result).toEqual(mockRows);
    });

    it("should return an empty array when no customer is found", async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] });

      const result = await custModel.getCustomer("UNKNOWN");

      expect(result).toEqual([]);
    });

    it("should handle errors when retrieving a customer", async () => {
      mockRequest.query.mockRejectedValue(new Error("Database Error"));

      await expect(custModel.getCustomer("U1")).rejects.toThrow(
        "Database Error"
      );
    });
  });

  describe("updateProfile", () => {
    it("should update the profile and return the updated row", async () => {
      const updatedRow = {
        UserId: "U1",
        Name: "Alice Updated",
        Email: "alice2@example.com",
        Phone: "12345678",
        AvatarUrl: "data:image/png;base64,abc",
      };
      mockRequest.query.mockResolvedValue({ recordset: [updatedRow] });

      const result = await custModel.updateProfile("U1", {
        Name: "Alice Updated",
        Email: "alice2@example.com",
        Phone: "12345678",
        AvatarUrl: "data:image/png;base64,abc",
      });

      expect(mockRequest.input).toHaveBeenCalledWith(
        "UserId",
        "NVarChar(255)",
        "U1"
      );
      expect(mockRequest.input).toHaveBeenCalledWith(
        "Name",
        "NVarChar(255)",
        "Alice Updated"
      );
      expect(mockRequest.input).toHaveBeenCalledWith(
        "Email",
        "NVarChar(255)",
        "alice2@example.com"
      );
      expect(mockRequest.input).toHaveBeenCalledWith(
        "Phone",
        "NVarChar(255)",
        "12345678"
      );
      expect(mockRequest.input).toHaveBeenCalledWith(
        "AvatarUrl",
        "NVarChar(MAX)",
        "data:image/png;base64,abc"
      );
      expect(mockRequest.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE Users")
      );
      expect(result).toEqual(updatedRow);
    });

    it("should pass null for AvatarUrl when not provided, leaving existing avatar untouched via COALESCE", async () => {
      const updatedRow = {
        UserId: "U1",
        Name: "Alice",
        Email: "alice@example.com",
        Phone: "12345678",
        AvatarUrl: "existing-avatar.jpg",
      };
      mockRequest.query.mockResolvedValue({ recordset: [updatedRow] });

      await custModel.updateProfile("U1", {
        Name: "Alice",
        Email: "alice@example.com",
        Phone: "12345678",
        AvatarUrl: null,
      });

      expect(mockRequest.input).toHaveBeenCalledWith(
        "AvatarUrl",
        "NVarChar(MAX)",
        null
      );
    });

    it("should return null when no user matched", async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] });

      const result = await custModel.updateProfile("UNKNOWN", {
        Name: "Nobody",
        Email: "nobody@example.com",
        Phone: "00000000",
        AvatarUrl: null,
      });

      expect(result).toBeNull();
    });

    it("should handle errors when updating a profile", async () => {
      mockRequest.query.mockRejectedValue(new Error("Database Error"));

      await expect(
        custModel.updateProfile("U1", {
          Name: "Alice",
          Email: "alice@example.com",
          Phone: "12345678",
          AvatarUrl: null,
        })
      ).rejects.toThrow("Database Error");
    });
  });

  describe("getPasswordHash", () => {
    it("should retrieve the password hash for a user", async () => {
      mockRequest.query.mockResolvedValue({
        recordset: [{ PasswordHash: "hashed-password" }],
      });

      const result = await custModel.getPasswordHash("U1");

      expect(mockRequest.input).toHaveBeenCalledWith(
        "UserId",
        "NVarChar(255)",
        "U1"
      );
      expect(mockRequest.query).toHaveBeenCalledWith(
        expect.stringContaining("FROM UserCredentials WHERE UserId = @UserId")
      );
      expect(result).toBe("hashed-password");
    });

    it("should return null when no matching user credentials row exists", async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] });

      const result = await custModel.getPasswordHash("UNKNOWN");

      expect(result).toBeNull();
    });

    it("should handle errors when retrieving the password hash", async () => {
      mockRequest.query.mockRejectedValue(new Error("Database Error"));

      await expect(custModel.getPasswordHash("U1")).rejects.toThrow(
        "Database Error"
      );
    });
  });

  describe("changePassword", () => {
    it("should return true when a row was updated", async () => {
      mockRequest.query.mockResolvedValue({ rowsAffected: [1] });

      const result = await custModel.changePassword("U1", "new-hash");

      expect(mockRequest.input).toHaveBeenCalledWith(
        "UserId",
        "NVarChar(255)",
        "U1"
      );
      expect(mockRequest.input).toHaveBeenCalledWith(
        "PasswordHash",
        "NVarChar(255)",
        "new-hash"
      );
      expect(mockRequest.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE UserCredentials")
      );
      expect(result).toBe(true);
    });

    it("should return false when no user matched", async () => {
      mockRequest.query.mockResolvedValue({ rowsAffected: [0] });

      const result = await custModel.changePassword("UNKNOWN", "new-hash");

      expect(result).toBe(false);
    });

    it("should handle errors when changing the password", async () => {
      mockRequest.query.mockRejectedValue(new Error("Database Error"));

      await expect(
        custModel.changePassword("U1", "new-hash")
      ).rejects.toThrow("Database Error");
    });
  });
});