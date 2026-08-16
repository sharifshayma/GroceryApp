// src/lib/__tests__/need-to-buy.test.ts
import { describe, it, expect } from "vitest";
import { isLowStock, computeNeedToBuy } from "@/lib/need-to-buy";

const milk = { id: "m", name: "Milk", emoji: "🥛" };
const eggs = { id: "e", name: "Eggs", emoji: "🥚" };

describe("isLowStock", () => {
  it("is true at or below threshold, false above", () => {
    expect(isLowStock(1, 1)).toBe(true);
    expect(isLowStock(0, 1)).toBe(true);
    expect(isLowStock(2, 1)).toBe(false);
  });
});

describe("computeNeedToBuy", () => {
  it("flags low-stock only", () => {
    const r = computeNeedToBuy({
      stockRows: [{ itemId: "m", item: milk, quantity: 0, lowThreshold: 1 }],
      openListItems: [],
    });
    expect(r.lowCount).toBe(1);
    expect(r.onListCount).toBe(0);
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]).toMatchObject({ item: milk, reason: "low_stock" });
    expect(r.entries[0].stock).toEqual({ quantity: 0, lowThreshold: 1 });
  });
  it("flags on-list only", () => {
    const r = computeNeedToBuy({
      stockRows: [{ itemId: "m", item: milk, quantity: 5, lowThreshold: 1 }],
      openListItems: [{ itemId: "e", item: eggs, listName: "Shop", quantity: 12 }],
    });
    expect(r.entries.map((x) => x.reason)).toEqual(["on_list"]);
    expect(r.entries[0].onLists).toEqual([{ listName: "Shop", quantity: 12 }]);
  });
  it("merges an item that is both low and on a list into one 'both' entry", () => {
    const r = computeNeedToBuy({
      stockRows: [{ itemId: "m", item: milk, quantity: 0, lowThreshold: 2 }],
      openListItems: [{ itemId: "m", item: milk, listName: "Shop", quantity: 1 }],
    });
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].reason).toBe("both");
    expect(r.entries[0].stock).toEqual({ quantity: 0, lowThreshold: 2 });
    expect(r.entries[0].onLists).toEqual([{ listName: "Shop", quantity: 1 }]);
  });
  it("empty input → empty", () => {
    expect(computeNeedToBuy({ stockRows: [], openListItems: [] })).toEqual({
      entries: [],
      lowCount: 0,
      onListCount: 0,
    });
  });
});
