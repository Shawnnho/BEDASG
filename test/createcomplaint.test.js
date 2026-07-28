jest.mock("../models/complaintModel");
jest.mock("../models/stallOwnerLookupModel");
jest.mock("../services/notificationEmails");
jest.mock("../middlewares/imageStorage");
jest.mock("../dbConfig");

const complaintModel = require("../models/complaintModel");
const stallOwnerLookupModel = require("../models/stallOwnerLookupModel");
const { validateBase64Image } = require("../middlewares/imageStorage");

const { createComplaint } = require("../controllers/complaintController");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function baseReq(overrides = {}) {
  return {
    user: { userId: "user1" },
    body: {
      stall: "asia-wok",
      stallName: "Asia Wok",
      firstName: "Test",
      lastName: "Customer",
      email: "test@example.com",
      message: "The food was cold.",
      ...overrides,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  complaintModel.createComplaint.mockResolvedValue({ complaintId: "c1" });
  stallOwnerLookupModel.getStallOwnerEmail.mockResolvedValue("owner@example.com");
});

describe("createComplaint", () => {
  test("succeeds with 201 when all required fields are present", async () => {
    const req = baseReq();
    const res = mockRes();
    await createComplaint(req, res);

    expect(complaintModel.createComplaint).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ complaintId: "c1" });
  });

  test.each(["stall", "firstName", "lastName", "email", "message"])(
    "returns 400 when %s is missing",
    async (missingField) => {
      const req = baseReq({ [missingField]: "" });
      const res = mockRes();
      await createComplaint(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(complaintModel.createComplaint).not.toHaveBeenCalled();
    },
  );

  test("returns 400 when the image fails validation", async () => {
    validateBase64Image.mockImplementation(() => {
      throw new Error("Unsupported image type.");
    });

    const req = baseReq({ image: "data:image/bogus;base64,xxx" });
    const res = mockRes();
    await createComplaint(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(complaintModel.createComplaint).not.toHaveBeenCalled();
  });
});