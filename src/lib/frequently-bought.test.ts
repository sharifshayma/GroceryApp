import { describe, it, expect } from "vitest";
import { rankFrequentlyBought } from "./frequently-bought";

describe("rankFrequentlyBought", () => {
  it("counts and sorts by frequency desc", () => {
    const rows = [{ itemId: "a" }, { itemId: "b" }, { itemId: "a" }, { itemId: "a" }, { itemId: "b" }, { itemId: "c" }];
    expect(rankFrequentlyBought(rows, 10)).toEqual([
      { itemId: "a", count: 3 },
      { itemId: "b", count: 2 },
      { itemId: "c", count: 1 },
    ]);
  });
  it("respects the limit", () => {
    const rows = [{ itemId: "a" }, { itemId: "b" }, { itemId: "c" }];
    expect(rankFrequentlyBought(rows, 2)).toHaveLength(2);
  });
  it("returns [] for no rows", () => {
    expect(rankFrequentlyBought([], 5)).toEqual([]);
  });
  it("breaks ties by first-seen order", () => {
    const rows = [{ itemId: "x" }, { itemId: "y" }];
    expect(rankFrequentlyBought(rows, 10)).toEqual([
      { itemId: "x", count: 1 },
      { itemId: "y", count: 1 },
    ]);
  });
});
