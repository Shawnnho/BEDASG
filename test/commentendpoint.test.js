jest.mock("../dbConfig");
jest.mock("../models/feedbackcommentModel");

const feedbackCommentModel = require("../models/feedbackcommentModel");
const { createComment, getComments } = require("../controllers/feedbackcommentController");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});


describe("createComment", () => {
  test("succeeds with 201 for a valid comment", async () => {
    feedbackCommentModel.createComment.mockResolvedValue({ commentId: "c1" });

    const req = {
      user: { userId: "user1", name: "Test User" },
      body: { reviewId: "r1", commentText: "Nice review!" },
    };
    const res = mockRes();
    await createComment(req, res);

    expect(feedbackCommentModel.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ reviewId: "r1", commentText: "Nice review!" }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("getComments", () => {
  test("returns the list of comments for a review", async () => {
    feedbackCommentModel.getCommentsByReview.mockResolvedValue([
      { CommentId: "c1", CommentText: "Nice!" },
    ]);

    const req = { params: { reviewId: "r1" } };
    const res = mockRes();
    await getComments(req, res);

    expect(res.json).toHaveBeenCalledWith([{ CommentId: "c1", CommentText: "Nice!" }]);
  });
});