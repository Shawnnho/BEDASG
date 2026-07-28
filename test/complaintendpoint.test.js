jest.mock("../models/complaintModel");
jest.mock("../dbConfig");

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

describe("updateComplaint — ownership check", () => {
  test("blocks with 403 when the complaint belongs to someone else", async () => {
    complaintModel.getComplaintById.mockResolvedValue({ ComplaintId: "c1", Uid: "other-user" });

    const req = {
      params: { complaintId: "c1" },
      user: { userId: "user1" },
      body: { message: "Trying to edit someone else's complaint" },
    };
    const res = mockRes();
    await updateComplaint(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(complaintModel.updateComplaint).not.toHaveBeenCalled();
  });

  test("rejects an empty message", async () => {
    complaintModel.getComplaintById.mockResolvedValue({ ComplaintId: "c1", Uid: "user1" });

    const req = {
      params: { complaintId: "c1" },
      user: { userId: "user1" },
      body: { message: "   " },
    };
    const res = mockRes();
    await updateComplaint(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("allows editing your own complaint", async () => {
    complaintModel.getComplaintById.mockResolvedValue({ ComplaintId: "c1", Uid: "user1" });
    complaintModel.updateComplaint.mockResolvedValue();

    const req = {
      params: { complaintId: "c1" },
      user: { userId: "user1" },
      body: { message: "Updated message" },
    };
    const res = mockRes();
    await updateComplaint(req, res);

    expect(complaintModel.updateComplaint).toHaveBeenCalledWith("c1", { message: "Updated message" });
    // Success path is res.json({ success: true }) with no explicit
    // .status() call — Express defaults to 200 on its own.
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("deleteComplaint — ownership check", () => {
  test("blocks with 403 when the complaint belongs to someone else", async () => {
    complaintModel.getComplaintById.mockResolvedValue({ ComplaintId: "c1", Uid: "other-user" });

    const req = { params: { complaintId: "c1" }, user: { userId: "user1" } };
    const res = mockRes();
    await deleteComplaint(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(complaintModel.deleteComplaint).not.toHaveBeenCalled();
  });

  test("allows deleting your own complaint", async () => {
    complaintModel.getComplaintById.mockResolvedValue({ ComplaintId: "c1", Uid: "user1" });
    complaintModel.deleteComplaint.mockResolvedValue();

    const req = { params: { complaintId: "c1" }, user: { userId: "user1" } };
    const res = mockRes();
    await deleteComplaint(req, res);

    expect(complaintModel.deleteComplaint).toHaveBeenCalledWith("c1");
    expect(res.status).toHaveBeenCalledWith(204);
  });
});