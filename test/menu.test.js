// tests/menu.test.js
// Controller tests for stallMenuController.js (Menu page: items + add-ons CRUD).
// Mocks stallMenuModel and orderModel (getUserInfo/getStallName).

const menuController = require("../controllers/stallMenuController");
const menuModel = require("../models/stallMenuModel");
const orderModel = require("../models/orderModel");

jest.mock("../models/stallMenuModel");
jest.mock("../models/orderModel");
jest.mock("../dbConfig", () => ({ poolPromise: Promise.resolve({}), sql: {} }));

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

/* ===================== getMenu ===================== */
describe("stallMenuController.getMenu", () => {
  it("returns menu items (200) on success", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1", Name: "Owner" });
    orderModel.getStallName.mockResolvedValue("Kopi-Fellas");
    menuModel.getStallFeatures.mockResolvedValue({});
    menuModel.getMenuByStall.mockResolvedValue([
      { MenuId: "m1", Name: "Kopi", Price: 1.2, Active: 1, Available: 1 },
    ]);
    menuModel.getPricesForMenus.mockResolvedValue([]);
    menuModel.getVariantKeysByStall.mockResolvedValue([]);

    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await menuController.getMenu(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.stallName).toBe("Kopi-Fellas");
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].name).toBe("Kopi");
  });

  it("returns 401 when not authenticated", async () => {
    const req = { user: {} };
    const res = mockRes();
    await menuController.getMenu(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 404 when no stall linked", async () => {
    orderModel.getUserInfo.mockResolvedValue({});
    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await menuController.getMenu(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ===================== createMenu ===================== */
describe("stallMenuController.createMenu", () => {
  it("creates a single-priced item (200)", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    menuModel.addMenuItem.mockResolvedValue("m1");
    const req = {
      user: { userId: "u1" },
      body: { name: "Teh", price: 1.5 },
    };
    const res = mockRes();
    await menuController.createMenu(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, menuId: "m1" });
  });

  it("returns 400 when name missing", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    const req = { user: { userId: "u1" }, body: { price: 1.5 } };
    const res = mockRes();
    await menuController.createMenu(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when no price and no variants", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    const req = { user: { userId: "u1" }, body: { name: "Teh" } };
    const res = mockRes();
    await menuController.createMenu(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("creates a variant-priced item and writes prices", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    menuModel.addMenuItem.mockResolvedValue("m2");
    const req = {
      user: { userId: "u1" },
      body: {
        name: "Kopi",
        variants: [{ variantKey: "S", price: 1.2 }, { variantKey: "L", price: 1.8 }],
      },
    };
    const res = mockRes();
    await menuController.createMenu(req, res);
    expect(menuModel.replaceMenuPrices).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, menuId: "m2" });
  });
});

/* ===================== editMenu ===================== */
describe("stallMenuController.editMenu", () => {
  it("edits an item (200)", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    menuModel.updateMenuItem.mockResolvedValue(1);
    const req = {
      user: { userId: "u1" },
      params: { menuId: "m1" },
      body: { name: "Kopi O", price: 1.3 },
    };
    const res = mockRes();
    await menuController.editMenu(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("returns 404 when item not found", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    menuModel.updateMenuItem.mockResolvedValue(0);
    const req = {
      user: { userId: "u1" },
      params: { menuId: "m1" },
      body: { name: "Kopi O", price: 1.3 },
    };
    const res = mockRes();
    await menuController.editMenu(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 400 when name missing", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    const req = {
      user: { userId: "u1" },
      params: { menuId: "m1" },
      body: { price: 1.3 },
    };
    const res = mockRes();
    await menuController.editMenu(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ===================== toggleMenu ===================== */
describe("stallMenuController.toggleMenu", () => {
  it("toggles an item (200)", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    menuModel.toggleMenuActive.mockResolvedValue(1);
    const req = {
      user: { userId: "u1" },
      params: { menuId: "m1" },
      body: { active: false },
    };
    const res = mockRes();
    await menuController.toggleMenu(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("returns 404 when item not found", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    menuModel.toggleMenuActive.mockResolvedValue(0);
    const req = {
      user: { userId: "u1" },
      params: { menuId: "m1" },
      body: { active: true },
    };
    const res = mockRes();
    await menuController.toggleMenu(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ===================== removeMenu ===================== */
describe("stallMenuController.removeMenu", () => {
  it("deletes an item (200)", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    menuModel.deleteMenuItem.mockResolvedValue(1);
    const req = { user: { userId: "u1" }, params: { menuId: "m1" } };
    const res = mockRes();
    await menuController.removeMenu(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("returns 404 when item not found", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    menuModel.deleteMenuItem.mockResolvedValue(0);
    const req = { user: { userId: "u1" }, params: { menuId: "m1" } };
    const res = mockRes();
    await menuController.removeMenu(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ===================== getAddons ===================== */
describe("stallMenuController.getAddons", () => {
  it("returns add-ons (200)", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    menuModel.getAddonsByStall.mockResolvedValue([
      { AddonId: "a1", Name: "Extra shot", Price: 0.5, Active: 1 },
    ]);
    menuModel.getCategoryRules.mockResolvedValue([]);
    menuModel.getCategoriesByStall.mockResolvedValue(["Coffee"]);
    const req = { user: { userId: "u1" } };
    const res = mockRes();
    await menuController.getAddons(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.addons).toHaveLength(1);
    expect(payload.categories).toEqual(["Coffee"]);
  });
});

/* ===================== createAddon ===================== */
describe("stallMenuController.createAddon", () => {
  it("creates an add-on (200)", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    menuModel.addAddon.mockResolvedValue("a1");
    const req = {
      user: { userId: "u1" },
      body: { name: "Extra shot", price: 0.5 },
    };
    const res = mockRes();
    await menuController.createAddon(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, addonId: "a1" });
  });

  it("returns 400 when name missing", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    const req = { user: { userId: "u1" }, body: { price: 0.5 } };
    const res = mockRes();
    await menuController.createAddon(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 on invalid rule type", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    const req = {
      user: { userId: "u1" },
      body: { name: "Extra", ruleType: "bogus" },
    };
    const res = mockRes();
    await menuController.createAddon(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when rule type has no categories", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    const req = {
      user: { userId: "u1" },
      body: { name: "Extra", ruleType: "allow", categories: [] },
    };
    const res = mockRes();
    await menuController.createAddon(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ===================== editAddon ===================== */
describe("stallMenuController.editAddon", () => {
  it("edits an add-on (200)", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    menuModel.updateAddon.mockResolvedValue(1);
    const req = {
      user: { userId: "u1" },
      params: { addonId: "a1" },
      body: { name: "Extra shot", price: 0.6 },
    };
    const res = mockRes();
    await menuController.editAddon(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("returns 404 when add-on not found", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    menuModel.updateAddon.mockResolvedValue(0);
    const req = {
      user: { userId: "u1" },
      params: { addonId: "a1" },
      body: { name: "Extra shot", price: 0.6 },
    };
    const res = mockRes();
    await menuController.editAddon(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ===================== toggleAddon ===================== */
describe("stallMenuController.toggleAddon", () => {
  it("toggles an add-on (200)", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    menuModel.toggleAddonActive.mockResolvedValue(1);
    const req = {
      user: { userId: "u1" },
      params: { addonId: "a1" },
      body: { active: false },
    };
    const res = mockRes();
    await menuController.toggleAddon(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("returns 404 when add-on not found", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    menuModel.toggleAddonActive.mockResolvedValue(0);
    const req = {
      user: { userId: "u1" },
      params: { addonId: "a1" },
      body: { active: true },
    };
    const res = mockRes();
    await menuController.toggleAddon(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ===================== removeAddon ===================== */
describe("stallMenuController.removeAddon", () => {
  it("deletes an add-on (200)", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    menuModel.deleteAddon.mockResolvedValue(1);
    const req = { user: { userId: "u1" }, params: { addonId: "a1" } };
    const res = mockRes();
    await menuController.removeAddon(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("returns 404 when add-on not found", async () => {
    orderModel.getUserInfo.mockResolvedValue({ StallId: "s1" });
    menuModel.deleteAddon.mockResolvedValue(0);
    const req = { user: { userId: "u1" }, params: { addonId: "a1" } };
    const res = mockRes();
    await menuController.removeAddon(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});