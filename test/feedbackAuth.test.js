jest.mock("../dbConfig");
jest.mock("../models/complaintModel");
jest.mock("../models/stallReviewModel");
jest.mock("../models/feedbackreportModel");

const complaintModel = require("../models/complaintModel");
const stallReviewModel = require("../models/stallReviewModel");
const feedbackReportModel = require("../models/feedbackreportModel");

const {
  requireComplaintExists,
  requireComplaintOwnership,
  requireReviewExists,
  requireReviewOwnership,
  requireNotOwnReview,
  requireNotAlreadyReported,
} = require("../middlewares/feedbackAuth");

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

describe("requireComplaintExists + requireComplaintOwnership", () => {
  test("returns 404 when the complaint doesn't exist", async () => {
    complaintModel.getComplaintById.mockResolvedValue(null);

    const req = { params: { complaintId: "missing" } };
    const res = mockRes();
    const next = jest.fn();
    requireComplaintExists(req, res, next);
    await flushPromises();

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  test("attaches req.complaint and calls next() when found", async () => {
    complaintModel.getComplaintById.mockResolvedValue({ ComplaintId: "c1", Uid: "user1" });

    const req = { params: { complaintId: "c1" } };
    const res = mockRes();
    const next = jest.fn();
    requireComplaintExists(req, res, next);
    await flushPromises();

    expect(req.complaint).toEqual({ ComplaintId: "c1", Uid: "user1" });
    expect(next).toHaveBeenCalled();
  });

  test("requireComplaintOwnership blocks with 403 for someone else's complaint", () => {
    const req = { complaint: { Uid: "other-user" }, user: { userId: "user1" } };
    const res = mockRes();
    const next = jest.fn();
    requireComplaintOwnership(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("requireComplaintOwnership calls next() for your own complaint", () => {
    const req = { complaint: { Uid: "user1" }, user: { userId: "user1" } };
    const res = mockRes();
    const next = jest.fn();
    requireComplaintOwnership(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("requireReviewExists + requireReviewOwnership", () => {
  test("returns 404 when the review doesn't exist", async () => {
    stallReviewModel.getReviewById.mockResolvedValue(null);

    const req = { params: { reviewId: "missing" }, body: {} };
    const res = mockRes();
    const next = jest.fn();
    requireReviewExists(req, res, next);
    await flushPromises();

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("reads reviewId from body when not in params (createReport shape)", async () => {
    stallReviewModel.getReviewById.mockResolvedValue({ ReviewId: "r1", UserId: "other-user" });

    const req = { params: {}, body: { reviewId: "r1" } };
    const res = mockRes();
    const next = jest.fn();
    requireReviewExists(req, res, next);
    await flushPromises();

    expect(stallReviewModel.getReviewById).toHaveBeenCalledWith("r1");
    expect(req.review).toEqual({ ReviewId: "r1", UserId: "other-user" });
  });

  test("requireReviewOwnership blocks with 403 for someone else's review", () => {
    const req = { review: { UserId: "other-user" }, user: { userId: "user1" } };
    const res = mockRes();
    const next = jest.fn();
    requireReviewOwnership(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireNotOwnReview", () => {
  test("blocks with 400 when reporting your own review", () => {
    const req = { review: { UserId: "user1" }, user: { userId: "user1" } };
    const res = mockRes();
    const next = jest.fn();
    requireNotOwnReview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test("calls next() when reporting someone else's review", () => {
    const req = { review: { UserId: "other-user" }, user: { userId: "user1" } };
    const res = mockRes();
    const next = jest.fn();
    requireNotOwnReview(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe("requireNotAlreadyReported", () => {
  test("blocks with 409 when this user already reported this review", async () => {
    feedbackReportModel.hasUserReported.mockResolvedValue(true);

    const req = { review: { ReviewId: "r1" }, user: { userId: "user1" } };
    const res = mockRes();
    const next = jest.fn();
    requireNotAlreadyReported(req, res, next);
    await flushPromises();

    expect(res.status).toHaveBeenCalledWith(409);
    expect(next).not.toHaveBeenCalled();
  });

  test("calls next() when this is a new report", async () => {
    feedbackReportModel.hasUserReported.mockResolvedValue(false);

    const req = { review: { ReviewId: "r1" }, user: { userId: "user1" } };
    const res = mockRes();
    const next = jest.fn();
    requireNotAlreadyReported(req, res, next);
    await flushPromises();

    expect(next).toHaveBeenCalled();
  });
});