jest.mock("../models/stallReviewModel");
jest.mock("../dbConfig");

const stallReviewModel = require("../models/stallReviewModel");
const {
  createReview,
  updateReview,
  deleteReview,
  getReview,
} = require("../controllers/stallReviewController");

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

describe("createReview — validation", () => {
  test("rejects a rating outside 1-5", async () => {
    const req = {
      user: { userId: "user1" },
      body: { stallId: "asia-wok", rating: 6, reviewText: "Great!" },
    };
    const res = mockRes();
    await createReview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(stallReviewModel.createReview).not.toHaveBeenCalled();
  });

  test("rejects when stallId is missing", async () => {
    const req = {
      user: { userId: "user1" },
      body: { rating: 5, reviewText: "Great!" },
    };
    const res = mockRes();
    await createReview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(stallReviewModel.createReview).not.toHaveBeenCalled();
  });

  // The controller does NOT validate reviewText — it defaults to "" and
  // proceeds. This confirms that actual (permissive) behavior rather than
  // asserting a 400 that never happens.
  test("allows an empty review text, defaulting it to an empty string", async () => {
    stallReviewModel.createReview.mockResolvedValue({ reviewId: "r1" });

    const req = {
      user: { userId: "user1" },
      body: { stallId: "asia-wok", rating: 5, reviewText: "" },
    };
    const res = mockRes();
    await createReview(req, res);

    expect(stallReviewModel.createReview).toHaveBeenCalledWith(
      expect.objectContaining({ reviewText: "" }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("updateReview — ownership check", () => {
  test("blocks with 403 when the review belongs to someone else", async () => {
    stallReviewModel.getReviewById.mockResolvedValue({ ReviewId: "r1", UserId: "other-user" });

    const req = {
      params: { reviewId: "r1" },
      user: { userId: "user1" },
      body: { rating: 5, reviewText: "Trying to edit someone else's review" },
    };
    const res = mockRes();
    await updateReview(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(stallReviewModel.updateReview).not.toHaveBeenCalled();
  });

  test("allows editing your own review", async () => {
    stallReviewModel.getReviewById.mockResolvedValue({ ReviewId: "r1", UserId: "user1" });
    stallReviewModel.updateReview.mockResolvedValue();

    const req = {
      params: { reviewId: "r1" },
      user: { userId: "user1" },
      body: { rating: 4, reviewText: "Updated review text" },
    };
    const res = mockRes();
    await updateReview(req, res);

    expect(stallReviewModel.updateReview).toHaveBeenCalled();
    // The controller's success path is res.json({ success: true }) with no
    // explicit .status() call — Express defaults to 200, but that means
    // the mock res.status is never actually invoked here.
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(res.status).not.toHaveBeenCalled();
  });

  test("returns 404 when the review doesn't exist", async () => {
    stallReviewModel.getReviewById.mockResolvedValue(null);

    const req = {
      params: { reviewId: "missing" },
      user: { userId: "user1" },
      body: { rating: 4, reviewText: "..." },
    };
    const res = mockRes();
    await updateReview(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("deleteReview — ownership check", () => {
  test("blocks with 403 when the review belongs to someone else", async () => {
    stallReviewModel.getReviewById.mockResolvedValue({ ReviewId: "r1", UserId: "other-user" });

    const req = { params: { reviewId: "r1" }, user: { userId: "user1" } };
    const res = mockRes();
    await deleteReview(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(stallReviewModel.deleteReview).not.toHaveBeenCalled();
  });

  test("allows deleting your own review", async () => {
    stallReviewModel.getReviewById.mockResolvedValue({ ReviewId: "r1", UserId: "user1" });
    stallReviewModel.deleteReview.mockResolvedValue();

    const req = { params: { reviewId: "r1" }, user: { userId: "user1" } };
    const res = mockRes();
    await deleteReview(req, res);

    expect(stallReviewModel.deleteReview).toHaveBeenCalledWith("r1");
    expect(res.status).toHaveBeenCalledWith(204);
  });
});

describe("getReview (public)", () => {
  test("returns 404 when the review doesn't exist", async () => {
    stallReviewModel.getReviewById.mockResolvedValue(null);

    const req = { params: { reviewId: "missing" } };
    const res = mockRes();
    await getReview(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("returns the review when it exists", async () => {
    stallReviewModel.getReviewById.mockResolvedValue({ ReviewId: "r1", Rating: 5 });

    const req = { params: { reviewId: "r1" } };
    const res = mockRes();
    await getReview(req, res);

    expect(res.json).toHaveBeenCalledWith({ ReviewId: "r1", Rating: 5 });
  });
});