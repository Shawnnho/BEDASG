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

const centreModel = require("../models/centreModel");
const feedbackReportModel = require("../models/feedbackreportModel");
const stallReviewModel = require("../models/stallReviewModel");

const {
  getReportedReviews,
  dismissReport,
  deleteReportedReview,
} = require("../controllers/operatorController");

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

describe("getReportedReviews", () => {
  test("passes every one of the operator's centre ids to the model", async () => {
    centreModel.getCentresByOperator.mockResolvedValue([
      { CentreId: "maxwell" },
      { CentreId: "tiong-bahru" },
    ]);
    feedbackReportModel.getReportsForCentres.mockResolvedValue([{ ReportId: "r1" }]);

    const req = { user: { userId: "op1" } };
    const res = mockRes();
    await getReportedReviews(req, res);

    expect(feedbackReportModel.getReportsForCentres).toHaveBeenCalledWith(["maxwell", "tiong-bahru"]);
    expect(res.json).toHaveBeenCalledWith([{ ReportId: "r1" }]);
  });
});

describe("dismissReport", () => {
  test("dismisses the report already attached by middleware", async () => {
    const req = { report: { ReportId: "r1", ReviewId: "review1" }, user: { userId: "op1" } };
    const res = mockRes();
    await dismissReport(req, res);

    expect(feedbackReportModel.dismissReport).toHaveBeenCalledWith("r1");
    expect(res.status).toHaveBeenCalledWith(204);
  });
});

describe("deleteReportedReview", () => {
  test("clears all reports for the review before deleting it", async () => {
    const req = { review: { ReviewId: "review1" }, user: { userId: "op1" } };
    const res = mockRes();
    await deleteReportedReview(req, res);

    expect(feedbackReportModel.deleteReportsByReviewId).toHaveBeenCalledWith("review1");
    expect(stallReviewModel.deleteReview).toHaveBeenCalledWith("review1");
    expect(res.status).toHaveBeenCalledWith(204);
  });
});