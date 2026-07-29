jest.mock("../dbConfig");
jest.mock("../models/complaintModel");

const complaintModel = require("../models/complaintModel");
const { getMyComplaints, updateComplaint, deleteComplaint } = require("../controllers/complaintController");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getMyComplaints", () => {
  test("returns the logged-in user's own complaints", async () => {
    complaintModel.getComplaintsByUser.mockResolvedValue([{ ComplaintId: "c1" }]);

    const req = { user: { userId: "user1" } };
    const res = mockRes();
    await getMyComplaints(req, res);

    expect(complaintModel.getComplaintsByUser).toHaveBeenCalledWith("user1");
    expect(res.json).toHaveBeenCalledWith([{ ComplaintId: "c1" }]);
  });
});

describe("updateComplaint", () => {
  test("updates the complaint already attached by middleware", async () => {
    complaintModel.updateComplaint.mockResolvedValue();

    const req = {
      params: { complaintId: "c1" },
      user: { userId: "user1" },
      complaint: { ComplaintId: "c1", Uid: "user1" },
      body: { message: "Updated message" },
    };
    const res = mockRes();
    await updateComplaint(req, res);

    expect(complaintModel.updateComplaint).toHaveBeenCalledWith("c1", { message: "Updated message" });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});

describe("deleteComplaint", () => {
  test("deletes the complaint already attached by middleware", async () => {
    complaintModel.deleteComplaint.mockResolvedValue();

    const req = {
      params: { complaintId: "c1" },
      user: { userId: "user1" },
      complaint: { ComplaintId: "c1", Uid: "user1" },
    };
    const res = mockRes();
    await deleteComplaint(req, res);

    expect(complaintModel.deleteComplaint).toHaveBeenCalledWith("c1");
    expect(res.status).toHaveBeenCalledWith(204);
  });
});