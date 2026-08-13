import { describe, it, expect } from "vitest";
import { markCheapest } from "./mcp-queries";

describe("markCheapest", () => {
  it("flags the min-price row per item", () => {
    const rows = [
      { itemId: "milk-1", item: "Milk", price: 7.5, store: "A", purchasedAt: "2026-08-01" },
      { itemId: "milk-1", item: "Milk", price: 6.9, store: "B", purchasedAt: "2026-08-02" },
      { itemId: "eggs-1", item: "Eggs", price: 12, store: "A", purchasedAt: "2026-08-01" },
    ];
    const out = markCheapest(rows);
    expect(out.find((r) => r.item === "Milk" && r.price === 6.9)!.cheapest).toBe(true);
    expect(out.find((r) => r.item === "Milk" && r.price === 7.5)!.cheapest).toBe(false);
    expect(out.find((r) => r.item === "Eggs")!.cheapest).toBe(true);
  });
  it("handles an empty list", () => {
    expect(markCheapest([])).toEqual([]);
  });
  it("evaluates same-name items independently when itemId differs", () => {
    // Two distinct items both named "Milk" (e.g. different households' catalogs
    // merged, or duplicate item names within a household) must not pool prices.
    const rows = [
      { itemId: "milk-A", item: "Milk", price: 10, store: "A", purchasedAt: "2026-08-01" },
      { itemId: "milk-A", item: "Milk", price: 12, store: "B", purchasedAt: "2026-08-02" },
      { itemId: "milk-B", item: "Milk", price: 5, store: "C", purchasedAt: "2026-08-01" },
      { itemId: "milk-B", item: "Milk", price: 8, store: "D", purchasedAt: "2026-08-02" },
    ];
    const out = markCheapest(rows);
    // milk-A's cheapest is 10, even though milk-B has a cheaper 5 overall.
    expect(out.find((r) => r.itemId === "milk-A" && r.price === 10)!.cheapest).toBe(true);
    expect(out.find((r) => r.itemId === "milk-A" && r.price === 12)!.cheapest).toBe(false);
    // milk-B's cheapest is 5, independent of milk-A.
    expect(out.find((r) => r.itemId === "milk-B" && r.price === 5)!.cheapest).toBe(true);
    expect(out.find((r) => r.itemId === "milk-B" && r.price === 8)!.cheapest).toBe(false);
  });
});
