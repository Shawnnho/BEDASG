jest.mock("../dbConfig");

const { computeBillId } = require("../models/operatorbillModel");

describe("computeBillId", () => {
  test("combines stallId and billMonth with an underscore", () => {
    expect(computeBillId("asia-wok", "2026-07")).toBe("asia-wok_2026-07");
  });

  test("produces different ids for different months", () => {
    const july = computeBillId("asia-wok", "2026-07");
    const august = computeBillId("asia-wok", "2026-08");
    expect(july).not.toBe(august);
  });

  test("produces different ids for different stalls in the same month", () => {
    const stallA = computeBillId("asia-wok", "2026-07");
    const stallB = computeBillId("kopi-fellas", "2026-07");
    expect(stallA).not.toBe(stallB);
  });
});