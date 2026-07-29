// tests/review.test.js
// Controller tests for stallReviewController.js (Review page + customer review flow).
// Mocks stallReviewModel and the imageStorage middleware.

const reviewController = require("../controllers/stallReviewController");
const reviewModel = require("../models/stallReviewModel");

jest.mock("../models/stallReviewModel");
jest.mock("../middlewares/imageStorage", () => ({
  validateBase64Image: (img) => img,
}));

jest.mock("../dbConfig", () => ({ poolPromise: Promise.resolve({}), sql: {} }));

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

/* ===================== createReview ===================== */
describe("stallReviewController.createReview", () => {
  it("creates a review (201) with valid data", async () => {
    reviewModel.createReview.mockResolvedValue({ reviewId: "r1" });
    const req = {
      user: { userId: "u1", name: "Damien" },
      body: { stallId: "s1", rating: 5, reviewText: "Great!" },
    };
    const res = mockRes();
    await reviewController.createReview(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ reviewId: "r1" });
  });

  it("returns 400 when stallId missing", async () => {
    const req = {
      user: { userId: "u1", name: "Damien" },
      body: { rating: 5 },
    };
    const res = mockRes();
    await reviewController.createReview(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when rating is out of range", async () => {
    const req = {
      user: { userId: "u1", name: "Damien" },
      body: { stallId: "s1", rating: 9 },
    };
    const res = mockRes();
    await reviewController.createReview(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ===================== getMyStallReviews ===================== */
describe("stallReviewController.getMyStallReviews", () => {
  it("returns stall reviews + item data (200)", async () => {
    reviewModel.getStallByOwnerUid.mockResolvedValue({
      StallId: "s1",
      StallName: "Kopi-Fellas",
    });
    reviewModel.getReviewsByStall.mockResolvedValue([{ ReviewId: "r1" }]);
    reviewModel.getStallRatingSummary.mockResolvedValue({
      reviewCount: 1,
      averageRating: 5,
    });
    reviewModel.getItemReviewsByStall.mockResolvedValue([{ ReviewId: "ir1" }]);
    reviewModel.getItemRatingSummaryByStall.mockResolvedValue([
      { ItemId: "m1", ItemName: "Milky Way" },
    ]);

    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await reviewController.getMyStallReviews(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.stallName).toBe("Kopi-Fellas");
    expect(payload.reviews).toHaveLength(1);
    expect(payload.itemReviews).toHaveLength(1);
    expect(payload.itemSummary).toHaveLength(1);
  });

  it("returns 404 when the owner has no stall", async () => {
    reviewModel.getStallByOwnerUid.mockResolvedValue(null);
    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await reviewController.getMyStallReviews(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ===================== getMyStallReviewCount ===================== */
describe("stallReviewController.getMyStallReviewCount", () => {
  it("returns the new-review count (200)", async () => {
    reviewModel.getStallByOwnerUid.mockResolvedValue({ StallId: "s1" });
    reviewModel.getReviewCountSince.mockResolvedValue(3);
    const req = { user: { userId: "u1" }, query: { since: "2026-07-01" } };
    const res = mockRes();
    await reviewController.getMyStallReviewCount(req, res);
    expect(res.json).toHaveBeenCalledWith({ newCount: 3 });
  });

  it("returns newCount:0 when the owner has no stall", async () => {
    reviewModel.getStallByOwnerUid.mockResolvedValue(null);
    const req = { user: { userId: "u1" }, query: {} };
    const res = mockRes();
    await reviewController.getMyStallReviewCount(req, res);
    expect(res.json).toHaveBeenCalledWith({ newCount: 0 });
  });
});

/* ===================== getStallRating ===================== */
describe("stallReviewController.getStallRating", () => {
  it("returns the rating summary (200)", async () => {
    reviewModel.getStallRatingSummary.mockResolvedValue({
      reviewCount: 9,
      averageRating: 5,
    });
    const req = { params: { stallId: "s1" } };
    const res = mockRes();
    await reviewController.getStallRating(req, res);
    expect(res.json).toHaveBeenCalledWith({
      reviewCount: 9,
      averageRating: 5,
    });
  });
});

/* ===================== updateReview ===================== */
describe("stallReviewController.updateReview", () => {
  it("updates own review (200)", async () => {
    reviewModel.getReviewById.mockResolvedValue({ UserId: "u1" });
    reviewModel.updateReview.mockResolvedValue();
    const req = {
      user: { userId: "u1" },
      params: { reviewId: "r1" },
      body: { rating: 4, reviewText: "Updated" },
    };
    const res = mockRes();
    await reviewController.updateReview(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("returns 404 when the review doesn't exist", async () => {
    reviewModel.getReviewById.mockResolvedValue(null);
    const req = {
      user: { userId: "u1" },
      params: { reviewId: "rX" },
      body: { rating: 4, reviewText: "x" },
    };
    const res = mockRes();
    await reviewController.updateReview(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 403 when editing someone else's review", async () => {
    reviewModel.getReviewById.mockResolvedValue({ UserId: "someoneElse" });
    const req = {
      user: { userId: "u1" },
      params: { reviewId: "r1" },
      body: { rating: 4, reviewText: "x" },
    };
    const res = mockRes();
    await reviewController.updateReview(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

/* ===================== deleteReview ===================== */
describe("stallReviewController.deleteReview", () => {
  it("deletes own review (204)", async () => {
    reviewModel.getReviewById.mockResolvedValue({ UserId: "u1" });
    reviewModel.deleteReview.mockResolvedValue(true);
    const req = { user: { userId: "u1" }, params: { reviewId: "r1" } };
    const res = mockRes();
    await reviewController.deleteReview(req, res);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("returns 403 when deleting someone else's review", async () => {
    reviewModel.getReviewById.mockResolvedValue({ UserId: "someoneElse" });
    const req = { user: { userId: "u1" }, params: { reviewId: "r1" } };
    const res = mockRes();
    await reviewController.deleteReview(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});