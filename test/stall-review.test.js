// tests/stall-review.test.js
// Tests for stallReviewController.js.
// NOTE: validation (create), and existence/ownership (update, delete) are
// handled by route MIDDLEWARE (validateCreateReview, requireReviewExists,
// requireReviewOwnership), NOT by the controller. These unit tests call the
// controller directly, so they only assert the branches the controller itself
// owns: the happy paths, the base64-image 400, the no-stall 404, the
// newCount:0 fallback, and the 500 error handlers.

const reviewController = require("../controllers/stallReviewController");
const reviewModel = require("../models/stallReviewModel");

jest.mock("../models/stallReviewModel");
jest.mock("../middlewares/imageStorage", () => ({
  validateBase64Image: (img) => {
    if (img === "BAD") throw new Error("Invalid image");
    return img;
  },
}));
jest.mock("../dbConfig", () => ({ poolPromise: Promise.resolve({}), sql: {} })); // ADD THIS

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
      body: { stallId: "s1", rating: 5, reviewText: "Great!", tags: ["Fast"] },
    };
    const res = mockRes();
    await reviewController.createReview(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ reviewId: "r1" });
  });

  it("returns 400 when the attached image is invalid", async () => {
    const req = {
      user: { userId: "u1", name: "Damien" },
      body: { stallId: "s1", rating: 5, image: "BAD" },
    };
    const res = mockRes();
    await reviewController.createReview(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 500 when the model throws", async () => {
    reviewModel.createReview.mockRejectedValue(new Error("DB"));
    const req = {
      user: { userId: "u1", name: "Damien" },
      body: { stallId: "s1", rating: 5 },
    };
    const res = mockRes();
    await reviewController.createReview(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ===================== getMyStallReviews ===================== */
describe("stallReviewController.getMyStallReviews", () => {
  it("returns the stall's reviews and summary (200)", async () => {
    reviewModel.getStallByOwnerUid.mockResolvedValue({
      StallId: "s1",
      StallName: "Kopi-Fellas",
    });
    reviewModel.getReviewsByStall.mockResolvedValue([{ ReviewId: "r1" }]);
    reviewModel.getStallRatingSummary.mockResolvedValue({
      reviewCount: 1,
      averageRating: 5,
    });

    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await reviewController.getMyStallReviews(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.stallName).toBe("Kopi-Fellas");
    expect(payload.reviews).toHaveLength(1);
    expect(payload.summary.reviewCount).toBe(1);
  });

  it("returns 404 when the owner has no stall", async () => {
    reviewModel.getStallByOwnerUid.mockResolvedValue(null);
    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await reviewController.getMyStallReviews(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 500 when the model throws", async () => {
    reviewModel.getStallByOwnerUid.mockRejectedValue(new Error("DB"));
    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await reviewController.getMyStallReviews(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
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
    expect(res.json).toHaveBeenCalledWith({ reviewCount: 9, averageRating: 5 });
  });
});

/* ===================== getReview ===================== */
describe("stallReviewController.getReview", () => {
  it("returns a review (200) when found", async () => {
    reviewModel.getReviewById.mockResolvedValue({ ReviewId: "r1" });
    const req = { params: { reviewId: "r1" } };
    const res = mockRes();
    await reviewController.getReview(req, res);
    expect(res.json).toHaveBeenCalledWith({ ReviewId: "r1" });
  });

  it("returns 404 when the review doesn't exist", async () => {
    reviewModel.getReviewById.mockResolvedValue(null);
    const req = { params: { reviewId: "rX" } };
    const res = mockRes();
    await reviewController.getReview(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ===================== updateReview ===================== */
// Ownership/existence are enforced by middleware; the controller just updates.
describe("stallReviewController.updateReview", () => {
  it("updates a review (200)", async () => {
    reviewModel.updateReview.mockResolvedValue();
    const req = {
      params: { reviewId: "r1" },
      body: { rating: 4, reviewText: " Updated ", tags: ["A", "B"] },
    };
    const res = mockRes();
    await reviewController.updateReview(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("returns 500 when the model throws", async () => {
    reviewModel.updateReview.mockRejectedValue(new Error("DB"));
    const req = {
      params: { reviewId: "r1" },
      body: { rating: 4, reviewText: "x", tags: [] },
    };
    const res = mockRes();
    await reviewController.updateReview(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ===================== deleteReview ===================== */
// Ownership/existence are enforced by middleware; the controller just deletes.
describe("stallReviewController.deleteReview", () => {
  it("deletes a review (204)", async () => {
    reviewModel.deleteReview.mockResolvedValue();
    const req = { params: { reviewId: "r1" } };
    const res = mockRes();
    await reviewController.deleteReview(req, res);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("returns 500 when the model throws", async () => {
    reviewModel.deleteReview.mockRejectedValue(new Error("DB"));
    const req = { params: { reviewId: "r1" } };
    const res = mockRes();
    await reviewController.deleteReview(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
