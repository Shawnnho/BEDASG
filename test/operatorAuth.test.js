jest.mock("../dbConfig");

jest.mock("../models/centreModel");
jest.mock("../models/stallModel");
jest.mock("../models/rentalAgreementModel");
jest.mock("../models/feedbackreportModel");
jest.mock("../models/stallReviewModel");

const centreModel = require("../models/centreModel");
const stallModel = require("../models/stallModel");
const rentalAgreementModel = require("../models/rentalAgreementModel");
const feedbackReportModel = require("../models/feedbackreportModel");
const stallReviewModel = require("../models/stallReviewModel");

const {
  requireCentreOwnershipFromParam,
  requireStallExists,
  requireStallExistsLoose,
  requireAgreementExists,
  requireCentreOwnershipFromReqAgreement,
  requireReportExists,
  requireReviewFromReqReport,
  requireStallFromReqReview,
  requireCentreOwnershipFromReqStall,
} = require("../middlewares/operatorAuth");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("requireCentreOwnershipFromParam", () => {
  test("calls next() and attaches req.centre when the operator owns it", async () => {
    centreModel.getCentreForOperator.mockResolvedValue({ CentreId: "maxwell" });

    const req = { params: { centreId: "maxwell" }, user: { userId: "op1" } };
    const res = mockRes();
    const next = jest.fn();
    requireCentreOwnershipFromParam(req, res, next);
    await flushPromises();

    expect(next).toHaveBeenCalled();
    expect(req.centre).toEqual({ CentreId: "maxwell" });
    expect(res.status).not.toHaveBeenCalled();
  });

  test("blocks with 403 when the centre doesn't belong to this operator", async () => {
    centreModel.getCentreForOperator.mockResolvedValue(null);

    const req = { params: { centreId: "not-mine" }, user: { userId: "op1" } };
    const res = mockRes();
    const next = jest.fn();
    requireCentreOwnershipFromParam(req, res, next);
    await flushPromises();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireStallExists", () => {
  test("returns 404 when the stall doesn't exist", async () => {
    stallModel.getStallById.mockResolvedValue(null);

    const req = { params: {}, body: { stallId: "missing" } };
    const res = mockRes();
    const next = jest.fn();
    requireStallExists(req, res, next);
    await flushPromises();

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireAgreementExists + requireCentreOwnershipFromReqAgreement", () => {
  test("returns 404 when the agreement doesn't exist", async () => {
    rentalAgreementModel.getRentalAgreementById.mockResolvedValue(null);

    const req = { params: { agreementId: "missing" } };
    const res = mockRes();
    const next = jest.fn();
    requireAgreementExists(req, res, next);
    await flushPromises();

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("blocks with 403 when the agreement's centre isn't the operator's", async () => {
    centreModel.getCentreForOperator.mockResolvedValue(null);

    const req = { agreement: { CentreId: "someone-elses" }, user: { userId: "op1" } };
    const res = mockRes();
    const next = jest.fn();
    requireCentreOwnershipFromReqAgreement(req, res, next);
    await flushPromises();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireStallExistsLoose + requireCentreOwnershipFromReqStall (used by getStallComplaints)", () => {
  test("returns 404 when the stall doesn't exist", async () => {
    stallModel.getStallCentreId.mockResolvedValue(null);

    const req = { params: { stallId: "missing" } };
    const res = mockRes();
    const next = jest.fn();
    requireStallExistsLoose(req, res, next);
    await flushPromises();

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  test("chain blocks with 403 when the stall's centre isn't the operator's", async () => {
    stallModel.getStallCentreId.mockResolvedValue({ CentreId: "someone-elses-centre" });
    centreModel.getCentreForOperator.mockResolvedValue(null);

    const req = { params: { stallId: "asia-wok" }, user: { userId: "op1" } };
    const res = mockRes();
    const next = jest.fn();

    requireStallExistsLoose(req, res, next);
    await flushPromises();
    expect(next).toHaveBeenCalledTimes(1);

    requireCentreOwnershipFromReqStall(req, res, next);
    await flushPromises();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).toHaveBeenCalledTimes(1); // never reached a 2nd call
  });
});

describe("report moderation middleware chain", () => {
  test("requireReportExists returns 404 when the report doesn't exist", async () => {
    feedbackReportModel.getReportById.mockResolvedValue(null);

    const req = { params: { reportId: "missing" } };
    const res = mockRes();
    const next = jest.fn();
    requireReportExists(req, res, next);
    await flushPromises();

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("full chain blocks with 403 when the stall's centre isn't the operator's", async () => {
    feedbackReportModel.getReportById.mockResolvedValue({ ReportId: "r1", ReviewId: "review1" });
    stallReviewModel.getReviewById.mockResolvedValue({ ReviewId: "review1", StallId: "asia-wok" });
    stallModel.getStallById.mockResolvedValue({ StallId: "asia-wok", CentreId: "not-mine" });
    centreModel.getCentreForOperator.mockResolvedValue(null);

    const req = { params: { reportId: "r1" }, user: { userId: "op1" } };
    const res = mockRes();
    const next = jest.fn();

    requireReportExists(req, res, next);
    await flushPromises();
    expect(next).toHaveBeenCalledTimes(1);

    requireReviewFromReqReport(req, res, next);
    await flushPromises();
    expect(next).toHaveBeenCalledTimes(2);

    requireStallFromReqReview(req, res, next);
    await flushPromises();
    expect(next).toHaveBeenCalledTimes(3);

    requireCentreOwnershipFromReqStall(req, res, next);
    await flushPromises();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).toHaveBeenCalledTimes(3); // never reached a 4th call
  });
});