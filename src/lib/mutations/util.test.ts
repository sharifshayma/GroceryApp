import { describe, it, expect } from "vitest";
import { clean, normalizeQuantity } from "./util";

describe("clean", () => {
  it("trims and returns non-empty", () => expect(clean("  hi ")).toBe("hi"));
  it("empty/whitespace → null", () => {
    expect(clean("   ")).toBeNull();
    expect(clean("")).toBeNull();
    expect(clean(undefined)).toBeNull();
    expect(clean(null)).toBeNull();
  });
});

describe("normalizeQuantity", () => {
  it("keeps a positive finite number", () => expect(normalizeQuantity(3)).toBe(3));
  it("0, negative, NaN, Infinity → 1", () => {
    expect(normalizeQuantity(0)).toBe(1);
    expect(normalizeQuantity(-2)).toBe(1);
    expect(normalizeQuantity(Number.NaN)).toBe(1);
    expect(normalizeQuantity(Number.POSITIVE_INFINITY)).toBe(1);
  });
});
