import { describe, it, expect } from "vitest";
import { markCheapest } from "./mcp-queries";

describe("markCheapest", () => {
  it("flags the min-price row per item", () => {
    const rows = [
      { item: "Milk", price: 7.5, store: "A", purchasedAt: "2026-08-01" },
      { item: "Milk", price: 6.9, store: "B", purchasedAt: "2026-08-02" },
      { item: "Eggs", price: 12, store: "A", purchasedAt: "2026-08-01" },
    ];
    const out = markCheapest(rows);
    expect(out.find((r) => r.item === "Milk" && r.price === 6.9)!.cheapest).toBe(true);
    expect(out.find((r) => r.item === "Milk" && r.price === 7.5)!.cheapest).toBe(false);
    expect(out.find((r) => r.item === "Eggs")!.cheapest).toBe(true);
  });
  it("handles an empty list", () => {
    expect(markCheapest([])).toEqual([]);
  });
});
