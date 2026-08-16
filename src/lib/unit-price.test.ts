import { describe, it, expect } from "vitest";
import { computeUnitPrice } from "./unit-price";

describe("computeUnitPrice", () => {
  it("price / amount for a positive amount", () => {
    expect(computeUnitPrice(6.9, 1)).toBeCloseTo(6.9);
    expect(computeUnitPrice(6.9, 2)).toBeCloseTo(3.45);
  });
  it("null for 0 / negative / NaN amount", () => {
    expect(computeUnitPrice(6.9, 0)).toBeNull();
    expect(computeUnitPrice(6.9, -1)).toBeNull();
    expect(computeUnitPrice(6.9, Number.NaN)).toBeNull();
  });
  it("null when amount is null/undefined", () => {
    expect(computeUnitPrice(6.9, null)).toBeNull();
    expect(computeUnitPrice(6.9, undefined)).toBeNull();
  });
  it("null for a non-finite price", () => {
    expect(computeUnitPrice(Number.NaN, 1)).toBeNull();
  });
});
