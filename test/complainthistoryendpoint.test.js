jest.mock("../dbConfig");
jest.mock("../models/centreModel");
jest.mock("../models/stallModel");
jest.mock("../models/rentalAgreementModel");
jest.mock("../models/operatorbillModel");
jest.mock("../models/operatorRevenueModel");
jest.mock("../models/stallRatingModel");
jest.mock("../models/stallComplaintHistoryModel");
jest.mock("../models/feedbackreportModel");
jest.mock("../models/stallReviewModel");

const stallComplaintHistoryModel = require("../models/stallComplaintHistoryModel");

const { getStallComplaints } = require("../controllers/operatorController");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getStallComplaints", () => {
  test("returns the complaint list for the given stallId", async () => {
    stallComplaintHistoryModel.getComplaintsByStall.mockResolvedValue([
      { ComplaintId: "c1", ComplaintType: "Hygiene" },
    ]);

    const req = { params: { stallId: "asia-wok" }, user: { userId: "op1" } };
    const res = mockRes();
    await getStallComplaints(req, res);

    expect(stallComplaintHistoryModel.getComplaintsByStall).toHaveBeenCalledWith("asia-wok");
    expect(res.json).toHaveBeenCalledWith([{ ComplaintId: "c1", ComplaintType: "Hygiene" }]);
  });
});