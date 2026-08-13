import { describe, it, expect } from "vitest";
import { validPrice, parseDate } from "./prices";

describe("validPrice", () => {
  it("accepts a positive finite number", () => expect(validPrice(6.9)).toBe(6.9));
  it("rejects 0/negative/NaN → null", () => {
    expect(validPrice(0)).toBeNull();
    expect(validPrice(-1)).toBeNull();
    expect(validPrice(Number.NaN)).toBeNull();
  });
});

describe("parseDate", () => {
  it("parses a valid YYYY-MM-DD", () => {
    expect(parseDate("2026-08-01").toISOString().slice(0, 10)).toBe("2026-08-01");
  });
  it("invalid/empty → a valid Date (today-ish, not NaN)", () => {
    expect(Number.isNaN(parseDate("not-a-date").getTime())).toBe(false);
    expect(Number.isNaN(parseDate(undefined).getTime())).toBe(false);
  });
});
