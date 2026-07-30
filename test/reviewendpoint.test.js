jest.mock("../dbConfig");
jest.mock("../models/stallReviewModel");
jest.mock("../middlewares/imageStorage");

const stallReviewModel = require("../models/stallReviewModel");
const { validateBase64Image } = require("../middlewares/imageStorage");
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

describe("createReview", () => {
  test("succeeds with 201 for a valid review", async () => {
    stallReviewModel.createReview.mockResolvedValue({ reviewId: "r1" });

    const req = {
      user: { userId: "user1" },
      body: { stallId: "asia-wok", rating: 5, reviewText: "Great!", tags: [] },
    };
    const res = mockRes();
    await createReview(req, res);

    expect(stallReviewModel.createReview).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("allows an empty review text, defaulting it to an empty string", async () => {
    stallReviewModel.createReview.mockResolvedValue({ reviewId: "r1" });

    const req = {
      user: { userId: "user1" },
      body: { stallId: "asia-wok", rating: 5, reviewText: "", tags: [] },
    };
    const res = mockRes();
    await createReview(req, res);

    expect(stallReviewModel.createReview).toHaveBeenCalledWith(
      expect.objectContaining({ reviewText: "" }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("returns 400 when the image fails validation", async () => {
    validateBase64Image.mockImplementation(() => {
      throw new Error("Unsupported image type.");
    });

    const req = {
      user: { userId: "user1" },
      body: { stallId: "asia-wok", rating: 5, reviewText: "Great!", image: "bad-image", tags: [] },
    };
    const res = mockRes();
    await createReview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(stallReviewModel.createReview).not.toHaveBeenCalled();
  });
});

describe("updateReview", () => {
  test("updates the review already attached by middleware", async () => {
    stallReviewModel.updateReview.mockResolvedValue();

    const req = {
      params: { reviewId: "r1" },
      user: { userId: "user1" },
      review: { ReviewId: "r1", UserId: "user1" },
      body: { rating: 4, reviewText: "Updated review text", tags: [] },
    };
    const res = mockRes();
    await updateReview(req, res);

    expect(stallReviewModel.updateReview).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});

describe("deleteReview", () => {
  test("deletes the review already attached by middleware", async () => {
    stallReviewModel.deleteReview.mockResolvedValue();

    const req = {
      params: { reviewId: "r1" },
      user: { userId: "user1" },
      review: { ReviewId: "r1", UserId: "user1" },
    };
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