jest.mock("../dbConfig");

const dbConfig = require("../dbConfig");
const { hasUserReported } = require("../models/feedbackreportModel");

describe("hasUserReported", () => {
  test("returns true when a matching report row exists", async () => {
    dbConfig.__mockQuery.mockResolvedValueOnce({ recordset: [{ "1": 1 }] });

    const result = await hasUserReported("review123", "user456");
    expect(result).toBe(true);
  });

  test("returns false when no matching report row exists", async () => {
    dbConfig.__mockQuery.mockResolvedValueOnce({ recordset: [] });

    const result = await hasUserReported("review123", "user456");
    expect(result).toBe(false);
  });
});