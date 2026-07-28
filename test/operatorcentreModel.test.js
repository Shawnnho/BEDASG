jest.mock("../models/centreModel");
jest.mock("../models/stallModel");
jest.mock("../models/rentalAgreementModel");
jest.mock("../models/operatorbillModel");
jest.mock("../models/operatorRevenueModel");
jest.mock("../models/stallRatingModel");
jest.mock("../models/stallComplaintHistoryModel");
jest.mock("../models/feedbackreportModel");
jest.mock("../models/stallReviewModel");
jest.mock("../dbConfig");


const centreModel = require("../models/centreModel");
const stallModel = require("../models/stallModel");
const orderModel = require("../models/operatorRevenueModel");
const stallRatingModel = require("../models/stallRatingModel");

const { getStallsForCentre, getAllStallsForOperator } = require("../controllers/operatorController");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getStallsForCentre", () => {
  test("blocks with 403 for a centre that isn't this operator's", async () => {
    centreModel.getCentreForOperator.mockResolvedValue(null);

    const req = { params: { centreId: "not-mine" }, user: { userId: "op1" } };
    const res = mockRes();
    await getStallsForCentre(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("attaches revenue and rating to every stall", async () => {
    centreModel.getCentreForOperator.mockResolvedValue({ CentreId: "maxwell" });
    stallModel.getStallsByCentre.mockResolvedValue([{ StallId: "asia-wok", StallName: "Asia Wok" }]);
    orderModel.getCompletedRevenueByStallIds.mockResolvedValue({ "asia-wok": 500 });
    stallRatingModel.getAverageRatingsByStallIds.mockResolvedValue({
      "asia-wok": { avgRating: 4.5, reviewCount: 10 },
    });

    const req = { params: { centreId: "maxwell" }, user: { userId: "op1" } };
    const res = mockRes();
    await getStallsForCentre(req, res);

    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody[0].Revenue).toBe(500);
    expect(responseBody[0].AvgRating).toBe(4.5);
    expect(responseBody[0].ReviewCount).toBe(10);
  });

  test("defaults revenue and rating to 0 when a stall has neither", async () => {
    centreModel.getCentreForOperator.mockResolvedValue({ CentreId: "maxwell" });
    stallModel.getStallsByCentre.mockResolvedValue([{ StallId: "new-stall", StallName: "New Stall" }]);
    orderModel.getCompletedRevenueByStallIds.mockResolvedValue({});
    stallRatingModel.getAverageRatingsByStallIds.mockResolvedValue({});

    const req = { params: { centreId: "maxwell" }, user: { userId: "op1" } };
    const res = mockRes();
    await getStallsForCentre(req, res);

    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody[0].Revenue).toBe(0);
    expect(responseBody[0].AvgRating).toBe(0);
    expect(responseBody[0].ReviewCount).toBe(0);
  });
});

describe("getAllStallsForOperator", () => {
  test("aggregates stalls across every centre and sorts them alphabetically", async () => {
    centreModel.getCentresByOperator.mockResolvedValue([
      { CentreId: "maxwell", Name: "Maxwell Food Centre" },
      { CentreId: "tiong-bahru", Name: "Tiong Bahru Market" },
    ]);
    stallModel.getStallsByCentre
      .mockResolvedValueOnce([{ StallId: "s2", StallName: "Zebra Stall" }])
      .mockResolvedValueOnce([{ StallId: "s1", StallName: "Asia Wok" }]);
    orderModel.getCompletedRevenueByStallIds.mockResolvedValue({});
    stallRatingModel.getAverageRatingsByStallIds.mockResolvedValue({});

    const req = { user: { userId: "op1" } };
    const res = mockRes();
    await getAllStallsForOperator(req, res);

    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody).toHaveLength(2);
    expect(responseBody[0].StallName).toBe("Asia Wok"); // alphabetically first
    expect(responseBody[1].StallName).toBe("Zebra Stall");
  });
});