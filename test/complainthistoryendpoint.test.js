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
  beforeEach(() => {
    feedbackReportModel.getReportById.mockResolvedValue({ ReportId: "r1", ReviewId: "review1" });
    stallReviewModel.getReviewById.mockResolvedValue({ ReviewId: "review1", StallId: "asia-wok" });
    stallModel.getStallById.mockResolvedValue({ StallId: "asia-wok", CentreId: "maxwell" });
  });

  test("dismisses successfully when the operator owns the centre", async () => {
    centreModel.getCentreForOperator.mockResolvedValue({ CentreId: "maxwell" });

    const req = { params: { reportId: "r1" }, user: { userId: "op1" } };
    const res = mockRes();
    await dismissReport(req, res);

    expect(feedbackReportModel.dismissReport).toHaveBeenCalledWith("r1");
    expect(res.status).toHaveBeenCalledWith(204);
  });

  test("blocks with 403 when the stall's centre isn't the operator's", async () => {
    centreModel.getCentreForOperator.mockResolvedValue(null);

    const req = { params: { reportId: "r1" }, user: { userId: "someone-else" } };
    const res = mockRes();
    await dismissReport(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(feedbackReportModel.dismissReport).not.toHaveBeenCalled();
  });

  test("returns 404 when the report doesn't exist", async () => {
    feedbackReportModel.getReportById.mockResolvedValue(null);

    const req = { params: { reportId: "missing" }, user: { userId: "op1" } };
    const res = mockRes();
    await dismissReport(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("deleteReportedReview", () => {
  beforeEach(() => {
    feedbackReportModel.getReportById.mockResolvedValue({ ReportId: "r1", ReviewId: "review1" });
    stallReviewModel.getReviewById.mockResolvedValue({ ReviewId: "review1", StallId: "asia-wok" });
    stallModel.getStallById.mockResolvedValue({ StallId: "asia-wok", CentreId: "maxwell" });
    centreModel.getCentreForOperator.mockResolvedValue({ CentreId: "maxwell" });
  });

  test("clears all reports for the review before deleting it", async () => {
    const req = { params: { reportId: "r1" }, user: { userId: "op1" } };
    const res = mockRes();
    await deleteReportedReview(req, res);

    expect(feedbackReportModel.deleteReportsByReviewId).toHaveBeenCalledWith("review1");
    expect(stallReviewModel.deleteReview).toHaveBeenCalledWith("review1");
    expect(res.status).toHaveBeenCalledWith(204);
  });
});