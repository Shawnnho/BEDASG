const bcrypt = require("bcrypt");
const custController = require("../controllers/custController");
const custModel = require("../models/custModel");

jest.mock("../models/custModel");
jest.mock("bcrypt");

describe("custController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  describe("getCustomer", () => {
    it("should return 400 when userId param is missing", async () => {
      const req = { params: {} };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.getCustomer(req, res);

      expect(custModel.getCustomer).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid user ID" });
    });

    it("should fetch and map the customer profile", async () => {
      const mockRows = [
        {
          UserId: "U1",
          Name: "Alice",
          Email: "alice@example.com",
          Phone: "12345678",
          UserRole: "customer",
          AvatarUrl: "avatar.jpg",
          CreatedAt: "2024-01-01",
        },
      ];
      custModel.getCustomer.mockResolvedValue(mockRows);

      const req = { params: { id: "U1" } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.getCustomer(req, res);

      expect(custModel.getCustomer).toHaveBeenCalledWith("U1");
      expect(res.json).toHaveBeenCalledWith({
        id: "U1",
        name: "Alice",
        email: "alice@example.com",
        phone: "12345678",
        role: "customer",
        pfp: "avatar.jpg",
        date: "2024-01-01",
      });
    });

    it("should default pfp to an empty string when AvatarUrl is missing", async () => {
      const mockRows = [
        {
          UserId: "U1",
          Name: "Alice",
          Email: "alice@example.com",
          Phone: "12345678",
          UserRole: "customer",
          AvatarUrl: null,
          CreatedAt: "2024-01-01",
        },
      ];
      custModel.getCustomer.mockResolvedValue(mockRows);

      const req = { params: { id: "U1" } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.getCustomer(req, res);

      const [result] = [res.json.mock.calls[0][0]];
      expect(result.pfp).toBe("");
    });

    it("should return 404 when the customer is not found", async () => {
      custModel.getCustomer.mockResolvedValue([]);

      const req = { params: { id: "UNKNOWN" } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.getCustomer(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Customer not found" });
    });

    it("should return 500 on error", async () => {
      custModel.getCustomer.mockRejectedValue(new Error("Database error"));

      const req = { params: { id: "U1" } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.getCustomer(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });

  describe("updateProfile", () => {
    it("should return 400 when userId param is missing", async () => {
      const req = { params: {}, body: {} };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.updateProfile(req, res);

      expect(custModel.updateProfile).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid user ID" });
    });

    it("should return 400 when Name, Email, or Phone is missing", async () => {
      const req = {
        params: { id: "U1" },
        body: { Name: "Alice", Email: "", Phone: "12345678" },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.updateProfile(req, res);

      expect(custModel.updateProfile).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Name, Email, and Phone are all required",
      });
    });

    it("should update the profile and return the mapped customer", async () => {
      const updatedRow = {
        UserId: "U1",
        Name: "Alice Updated",
        Email: "alice2@example.com",
        Phone: "87654321",
        AvatarUrl: "new-avatar.jpg",
      };
      custModel.updateProfile.mockResolvedValue(updatedRow);

      const req = {
        params: { id: "U1" },
        body: {
          Name: "Alice Updated",
          Email: "alice2@example.com",
          Phone: "87654321",
          AvatarUrl: "data:image/png;base64,abc",
        },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.updateProfile(req, res);

      expect(custModel.updateProfile).toHaveBeenCalledWith("U1", {
        Name: "Alice Updated",
        Email: "alice2@example.com",
        Phone: "87654321",
        AvatarUrl: "data:image/png;base64,abc",
      });
      expect(res.json).toHaveBeenCalledWith({
        id: "U1",
        name: "Alice Updated",
        email: "alice2@example.com",
        phone: "87654321",
        pfp: "new-avatar.jpg",
      });
    });

    it("should pass AvatarUrl as null when omitted from the request body", async () => {
      const updatedRow = {
        UserId: "U1",
        Name: "Alice",
        Email: "alice@example.com",
        Phone: "12345678",
        AvatarUrl: null,
      };
      custModel.updateProfile.mockResolvedValue(updatedRow);

      const req = {
        params: { id: "U1" },
        body: { Name: "Alice", Email: "alice@example.com", Phone: "12345678" },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.updateProfile(req, res);

      expect(custModel.updateProfile).toHaveBeenCalledWith("U1", {
        Name: "Alice",
        Email: "alice@example.com",
        Phone: "12345678",
        AvatarUrl: null,
      });
    });

    it("should default pfp to an empty string when the updated row has no AvatarUrl", async () => {
      const updatedRow = {
        UserId: "U1",
        Name: "Alice",
        Email: "alice@example.com",
        Phone: "12345678",
        AvatarUrl: null,
      };
      custModel.updateProfile.mockResolvedValue(updatedRow);

      const req = {
        params: { id: "U1" },
        body: { Name: "Alice", Email: "alice@example.com", Phone: "12345678" },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.updateProfile(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ pfp: "" })
      );
    });

    it("should return 404 when the customer is not found", async () => {
      custModel.updateProfile.mockResolvedValue(null);

      const req = {
        params: { id: "UNKNOWN" },
        body: { Name: "Alice", Email: "alice@example.com", Phone: "12345678" },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Customer not found" });
    });

    it("should return 500 on error", async () => {
      custModel.updateProfile.mockRejectedValue(new Error("Database error"));

      const req = {
        params: { id: "U1" },
        body: { Name: "Alice", Email: "alice@example.com", Phone: "12345678" },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });

  describe("changePassword", () => {
    it("should return 400 when userId param is missing", async () => {
      const req = { params: {}, body: {} };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.changePassword(req, res);

      expect(custModel.getPasswordHash).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid user ID" });
    });

    it("should return 400 when currentPassword or newPassword is missing", async () => {
      const req = {
        params: { id: "U1" },
        body: { currentPassword: "oldpass" },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.changePassword(req, res);

      expect(custModel.getPasswordHash).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "currentPassword and newPassword are both required",
      });
    });

    it("should return 400 when newPassword is shorter than 8 characters", async () => {
      const req = {
        params: { id: "U1" },
        body: { currentPassword: "oldpass", newPassword: "short" },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.changePassword(req, res);

      expect(custModel.getPasswordHash).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "newPassword must be at least 8 characters",
      });
    });

    it("should return 404 when the customer has no password hash on record", async () => {
      custModel.getPasswordHash.mockResolvedValue(null);

      const req = {
        params: { id: "UNKNOWN" },
        body: { currentPassword: "oldpass", newPassword: "newpassword123" },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Customer not found" });
    });

    it("should return 401 when the current password does not match", async () => {
      custModel.getPasswordHash.mockResolvedValue("existing-hash");
      bcrypt.compare.mockResolvedValue(false);

      const req = {
        params: { id: "U1" },
        body: { currentPassword: "wrongpass", newPassword: "newpassword123" },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.changePassword(req, res);

      expect(bcrypt.compare).toHaveBeenCalledWith(
        "wrongpass",
        "existing-hash"
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Current password is incorrect",
      });
    });

    it("should hash the new password and update it successfully", async () => {
      custModel.getPasswordHash.mockResolvedValue("existing-hash");
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue("new-hashed-password");
      custModel.changePassword.mockResolvedValue(true);

      const req = {
        params: { id: "U1" },
        body: { currentPassword: "oldpass", newPassword: "newpassword123" },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.changePassword(req, res);

      expect(bcrypt.compare).toHaveBeenCalledWith("oldpass", "existing-hash");
      expect(bcrypt.hash).toHaveBeenCalledWith("newpassword123", 10);
      expect(custModel.changePassword).toHaveBeenCalledWith(
        "U1",
        "new-hashed-password"
      );
      expect(res.json).toHaveBeenCalledWith({
        message: "Password updated successfully",
      });
    });

    it("should return 404 when the final update finds no matching user", async () => {
      custModel.getPasswordHash.mockResolvedValue("existing-hash");
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue("new-hashed-password");
      custModel.changePassword.mockResolvedValue(false);

      const req = {
        params: { id: "U1" },
        body: { currentPassword: "oldpass", newPassword: "newpassword123" },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Customer not found" });
    });

    it("should return 500 on unexpected error", async () => {
      custModel.getPasswordHash.mockRejectedValue(new Error("Database error"));

      const req = {
        params: { id: "U1" },
        body: { currentPassword: "oldpass", newPassword: "newpassword123" },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await custController.changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });
});