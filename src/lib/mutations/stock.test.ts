import { describe, it, expect } from "vitest";
import { nonNeg } from "./stock";

describe("nonNeg", () => {
  it("keeps a non-negative finite number", () => {
    expect(nonNeg(3, 0)).toBe(3);
    expect(nonNeg(0, 1)).toBe(0);
  });
  it("clamps a negative to 0", () => expect(nonNeg(-5, 1)).toBe(0));
  it("non-finite → fallback", () => {
    expect(nonNeg(Number.NaN, 1)).toBe(1);
    expect(nonNeg(Number.POSITIVE_INFINITY, 2)).toBe(2);
  });
});
