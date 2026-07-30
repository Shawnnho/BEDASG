jest.mock("../dbConfig");
jest.mock("../models/savedCardModel");

const SavedCardModel = require("../models/savedCardModel");
const {
  getSavedCards,
  saveCard,
  deleteSavedCard,
} = require("../controllers/savedCardController");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function baseReq(overrides = {}) {
  return {
    user: { userId: "user1" },
    params: { uid: "user1", ...overrides.params },
    body: { ...overrides.body },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Saved Card Controller", () => {
  describe("getSavedCards", () => {
    test("returns 403 if user tries to access another user's cards", async () => {
      const req = baseReq({ params: { uid: "hacker22" } });
      const res = mockRes();

      await getSavedCards(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "You can only access your own saved cards",
      });
      expect(SavedCardModel.getSavedCards).not.toHaveBeenCalled();
    });

    test("returns 200 and the list of saved cards on success", async () => {
      const mockCards = [
        { SavedCardId: 1, CardBrand: "visa", Last4: "4242", ExpMonth: 12, ExpYear: 2026 },
      ];
      SavedCardModel.getSavedCards.mockResolvedValue(mockCards);

      const req = baseReq();
      const res = mockRes();

      await getSavedCards(req, res);

      expect(SavedCardModel.getSavedCards).toHaveBeenCalledWith("user1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockCards);
    });

    test("returns 500 when database fails", async () => {
      SavedCardModel.getSavedCards.mockRejectedValue(new Error("DB Error"));

      const req = baseReq();
      const res = mockRes();

      await getSavedCards(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Failed to fetch saved cards",
        details: "DB Error",
      });
    });
  });

  describe("saveCard", () => {
    test("returns 403 if user tries to save a card to another account", async () => {
      const req = baseReq({ params: { uid: "hacker22" } });
      const res = mockRes();

      await saveCard(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test("returns 400 if last4 is invalid", async () => {
      const req = baseReq({
        body: { brand: "visa", last4: "abcd", expMonth: 12, expYear: 2026 },
      });
      const res = mockRes();

      await saveCard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid last4" });
    });

    test("returns 400 if expMonth is invalid", async () => {
      const req = baseReq({
        body: { brand: "visa", last4: "4242", expMonth: 13, expYear: 2026 },
      });
      const res = mockRes();

      await saveCard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid expiry month" });
    });

    test("returns 400 if expYear is invalid", async () => {
      const req = baseReq({
        body: { brand: "visa", last4: "4242", expMonth: 12, expYear: 1999 },
      });
      const res = mockRes();

      await saveCard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid expiry year" });
    });

    test("returns 201 on success and sanitizes unknown brands to 'card'", async () => {
      SavedCardModel.saveCard.mockResolvedValue(99);

      const req = baseReq({
        body: { brand: "discover", last4: "4242", expMonth: 12, expYear: 2026 },
      });
      const res = mockRes();

      await saveCard(req, res);

      expect(SavedCardModel.saveCard).toHaveBeenCalledWith("user1", {
        brand: "card", // "discover" should be sanitized to "card"
        last4: "4242",
        expMonth: 12,
        expYear: 2026,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, savedCardId: 99 });
    });

    test("returns 500 when database fails", async () => {
      SavedCardModel.saveCard.mockRejectedValue(new Error("DB Error"));

      const req = baseReq({
        body: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2026 },
      });
      const res = mockRes();

      await saveCard(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Failed to save card",
        details: "DB Error",
      });
    });
  });

  describe("deleteSavedCard", () => {
    test("returns 403 if user tries to delete another user's card", async () => {
      const req = baseReq({ params: { uid: "hacker22", savedCardId: "1" } });
      const res = mockRes();

      await deleteSavedCard(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test("returns 404 if the card is not found or deleted count is 0", async () => {
      SavedCardModel.deleteSavedCard.mockResolvedValue(0);

      const req = baseReq({ params: { savedCardId: "99" } });
      const res = mockRes();

      await deleteSavedCard(req, res);

      expect(SavedCardModel.deleteSavedCard).toHaveBeenCalledWith("user1", "99");
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Saved card not found" });
    });

    test("returns 200 on successful deletion", async () => {
      SavedCardModel.deleteSavedCard.mockResolvedValue(1);

      const req = baseReq({ params: { savedCardId: "99" } });
      const res = mockRes();

      await deleteSavedCard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    test("returns 500 when database fails", async () => {
      SavedCardModel.deleteSavedCard.mockRejectedValue(new Error("DB Error"));

      const req = baseReq({ params: { savedCardId: "99" } });
      const res = mockRes();

      await deleteSavedCard(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Failed to delete saved card",
        details: "DB Error",
      });
    });
  });
});