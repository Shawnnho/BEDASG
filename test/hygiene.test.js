// tests/hygiene.test.js
// Controller tests for hygieneController.js (Hygiene page).
// Mocks hygieneModel.

const hygieneController = require("../controllers/hygieneController");
const hygieneModel = require("../models/hygieneModel");

jest.mock("../models/hygieneModel");
jest.mock("../dbConfig", () => ({ poolPromise: Promise.resolve({}), sql: {} }));

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

/* ===================== listStalls ===================== */
describe("hygieneController.listStalls", () => {
  it("returns stalls for the role (200)", async () => {
    hygieneModel.getStallsForRole.mockResolvedValue([{ StallId: "s1" }]);
    const req = { user: { userId: "u1", role: "stallholder" } };
    const res = mockRes();
    await hygieneController.listStalls(req, res);
    expect(res.json).toHaveBeenCalledWith([{ StallId: "s1" }]);
  });

  it("returns 500 on model error", async () => {
    hygieneModel.getStallsForRole.mockRejectedValue(new Error("DB"));
    const req = { user: { userId: "u1", role: "stallholder" } };
    const res = mockRes();
    await hygieneController.listStalls(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ===================== getStall ===================== */
describe("hygieneController.getStall", () => {
  it("returns stall summary (200); owner sees upcoming inspection", async () => {
    hygieneModel.getStallSummary.mockResolvedValue({
      StallId: "s1",
      StallName: "Kopi-Fellas",
      OwnerUid: "u1",
      HygieneGrade: "A",
    });
    hygieneModel.getUpcomingInspection.mockResolvedValue({
      date: "2026-08-01",
    });
    const req = {
      user: { userId: "u1", role: "stallholder" },
      params: { stallId: "s1" },
    };
    const res = mockRes();
    await hygieneController.getStall(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.name).toBe("Kopi-Fellas");
    expect(payload.isOwner).toBe(true);
    expect(payload.upcoming).not.toBeNull();
  });

  it("returns 404 when stall not found", async () => {
    hygieneModel.getStallSummary.mockResolvedValue(null);
    const req = {
      user: { userId: "u1", role: "stallholder" },
      params: { stallId: "sX" },
    };
    const res = mockRes();
    await hygieneController.getStall(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("hides upcoming inspection from a non-owner, non-officer", async () => {
    hygieneModel.getStallSummary.mockResolvedValue({
      StallId: "s1",
      StallName: "Kopi-Fellas",
      OwnerUid: "someoneElse",
      HygieneGrade: "A",
    });
    const req = {
      user: { userId: "u1", role: "customer" },
      params: { stallId: "s1" },
    };
    const res = mockRes();
    await hygieneController.getStall(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.isOwner).toBe(false);
    expect(payload.upcoming).toBeNull();
  });
});

/* ===================== getInspections ===================== */
describe("hygieneController.getInspections", () => {
  it("returns mapped inspections (200)", async () => {
    hygieneModel.getCompletedInspections.mockResolvedValue([
      {
        DateTs: 123,
        InspectionDate: "2026-02-08",
        InspectionScore: 90,
        InspectionGrade: "A",
        Remarks: "Clean",
        OfficerName: "Officer Tan",
        BreakdownJson: null,
      },
    ]);
    const req = { params: { stallId: "s1" } };
    const res = mockRes();
    await hygieneController.getInspections(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toHaveLength(1);
    expect(payload[0].score).toBe(90);
    expect(payload[0].grade).toBe("A");
  });

  it("returns 500 on model error", async () => {
    hygieneModel.getCompletedInspections.mockRejectedValue(new Error("DB"));
    const req = { params: { stallId: "s1" } };
    const res = mockRes();
    await hygieneController.getInspections(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ===================== getMarketComparison ===================== */
describe("hygieneController.getMarketComparison", () => {
  it("returns 404 when stall not found", async () => {
    hygieneModel.getStallSummary.mockResolvedValue(null);
    const req = { params: { stallId: "sX" } };
    const res = mockRes();
    await hygieneController.getMarketComparison(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 'not ranked' when the stall has no centre", async () => {
    hygieneModel.getStallSummary.mockResolvedValue({
      StallId: "s1",
      CentreId: null,
    });
    const req = { params: { stallId: "s1" } };
    const res = mockRes();
    await hygieneController.getMarketComparison(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.ranking).toBeNull();
    expect(payload.totalStalls).toBe(0);
  });

  it("computes ranking when enough stalls have scores", async () => {
    hygieneModel.getStallSummary.mockResolvedValue({
      StallId: "s1",
      CentreId: "c1",
    });
    hygieneModel.getCentreStallIds.mockResolvedValue(["s1", "s2", "s3"]);
    // s1=90, s2=80, s3=70  -> s1 ranks #1 of 3
    hygieneModel.getLatestCompletedScore
      .mockResolvedValueOnce(90)
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce(70);
    const req = { params: { stallId: "s1" } };
    const res = mockRes();
    await hygieneController.getMarketComparison(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.ranking).toBe(1);
    expect(payload.totalStalls).toBe(3);
    expect(payload.stallScore).toBe(90);
  });

  it("returns 'not ranked' when the stall itself has no score", async () => {
    hygieneModel.getStallSummary.mockResolvedValue({
      StallId: "s1",
      CentreId: "c1",
    });
    hygieneModel.getCentreStallIds.mockResolvedValue(["s1", "s2"]);
    // only s2 has a score; s1 (requested) does not
    hygieneModel.getLatestCompletedScore
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(80);
    const req = { params: { stallId: "s1" } };
    const res = mockRes();
    await hygieneController.getMarketComparison(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.ranking).toBeNull();
  });
});
