// tests/account.test.js
// Controller tests for stallAccountController.js (Account page).
// Mocks stallAccountModel. bcrypt runs for real (fast enough for tests).

const accountController = require("../controllers/stallAccountController");
const accountModel = require("../models/stallAccountModel");
const bcrypt = require("bcrypt");

jest.mock("../models/stallAccountModel");

jest.mock("../dbConfig", () => ({ poolPromise: Promise.resolve({}), sql: {} }));

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

/* ===================== getAccount ===================== */
describe("stallAccountController.getAccount", () => {
  it("returns profile + notif prefs (200)", async () => {
    accountModel.getAccount.mockResolvedValue({
      UserId: "u1",
      Name: "Owner",
      Email: "o@x.com",
      StallId: "s1",
      NotifNewOrders: 1,
      NotifNewReview: 0,
    });
    accountModel.getStallHours.mockResolvedValue([]);
    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await accountController.getAccount(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.profile.name).toBe("Owner");
    expect(payload.notifPrefs.newOrders).toBe(true);
    expect(payload.notifPrefs.newReview).toBe(false);
  });

  it("returns 404 when the account isn't found", async () => {
    accountModel.getAccount.mockResolvedValue(null);
    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await accountController.getAccount(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 401 when not authenticated", async () => {
    const req = { user: {} };
    const res = mockRes();
    await accountController.getAccount(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

/* ===================== updateProfile ===================== */
describe("stallAccountController.updateProfile", () => {
  it("updates the profile (200)", async () => {
    accountModel.updateProfile.mockResolvedValue(1);
    const req = { user: { userId: "u1" }, body: { name: "New Name" } };
    const res = mockRes();
    await accountController.updateProfile(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("returns 400 when name missing", async () => {
    const req = { user: { userId: "u1" }, body: {} };
    const res = mockRes();
    await accountController.updateProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 on invalid SG phone", async () => {
    const req = {
      user: { userId: "u1" },
      body: { name: "Owner", phone: "12345" },
    };
    const res = mockRes();
    await accountController.updateProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ===================== updateNotifPrefs ===================== */
describe("stallAccountController.updateNotifPrefs", () => {
  it("saves notification preferences (200)", async () => {
    accountModel.updateNotifPrefs.mockResolvedValue(1);
    const req = {
      user: { userId: "u1" },
      body: { newOrders: true, orderUpdates: false, newReview: true, hygiene: false },
    };
    const res = mockRes();
    await accountController.updateNotifPrefs(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(accountModel.updateNotifPrefs).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ newOrders: true }),
    );
  });

  it("returns 401 when not authenticated", async () => {
    const req = { user: {}, body: {} };
    const res = mockRes();
    await accountController.updateNotifPrefs(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

/* ===================== changePassword ===================== */
describe("stallAccountController.changePassword", () => {
  it("changes the password (200) when current password is correct", async () => {
    const hash = await bcrypt.hash("oldpass123", 10);
    accountModel.getPasswordHash.mockResolvedValue(hash);
    accountModel.setPasswordHash.mockResolvedValue(1);
    const req = {
      user: { userId: "u1" },
      body: { currentPassword: "oldpass123", newPassword: "newpass456" },
    };
    const res = mockRes();
    await accountController.changePassword(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("returns 403 when the current password is wrong", async () => {
    const hash = await bcrypt.hash("realpass123", 10);
    accountModel.getPasswordHash.mockResolvedValue(hash);
    const req = {
      user: { userId: "u1" },
      body: { currentPassword: "wrongpass", newPassword: "newpass456" },
    };
    const res = mockRes();
    await accountController.changePassword(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 400 when the new password is too short", async () => {
    const req = {
      user: { userId: "u1" },
      body: { currentPassword: "oldpass123", newPassword: "short" },
    };
    const res = mockRes();
    await accountController.changePassword(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when fields are missing", async () => {
    const req = { user: { userId: "u1" }, body: { currentPassword: "x" } };
    const res = mockRes();
    await accountController.changePassword(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ===================== deactivateAccount ===================== */
describe("stallAccountController.deactivateAccount", () => {
  it("deactivates (200) with the correct password and clears the cookie", async () => {
    const hash = await bcrypt.hash("mypass123", 10);
    accountModel.getPasswordHash.mockResolvedValue(hash);
    accountModel.getAccount.mockResolvedValue({ StallId: "s1" });
    accountModel.deactivateAccount.mockResolvedValue();
    const req = { user: { userId: "u1" }, body: { password: "mypass123" } };
    const res = mockRes();
    await accountController.deactivateAccount(req, res);
    expect(res.clearCookie).toHaveBeenCalledWith("accessToken");
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("returns 403 on a wrong password", async () => {
    const hash = await bcrypt.hash("realpass123", 10);
    accountModel.getPasswordHash.mockResolvedValue(hash);
    const req = { user: { userId: "u1" }, body: { password: "wrong" } };
    const res = mockRes();
    await accountController.deactivateAccount(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 400 when password missing", async () => {
    const req = { user: { userId: "u1" }, body: {} };
    const res = mockRes();
    await accountController.deactivateAccount(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ===================== setStallActive ===================== */
describe("stallAccountController.setStallActive", () => {
  it("sets the stall inactive (200) without publish checks", async () => {
    accountModel.getAccount.mockResolvedValue({ StallId: "s1" });
    accountModel.setStallActive.mockResolvedValue(1);
    const req = { user: { userId: "u1" }, body: { isActive: false } };
    const res = mockRes();
    await accountController.setStallActive(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, isActive: false });
  });

  it("blocks going live (400) when the profile is incomplete", async () => {
    accountModel.getAccount.mockResolvedValue({ StallId: "s1" }); // missing name/cuisine/etc
    const req = { user: { userId: "u1" }, body: { isActive: true } };
    const res = mockRes();
    await accountController.setStallActive(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});