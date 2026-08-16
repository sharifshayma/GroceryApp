import { describe, it, expect } from "vitest";
import { cheapestByItem } from "@/lib/cheapest-price";

describe("cheapestByItem", () => {
  it("keeps the min-price entry per item", () => {
    const m = cheapestByItem([
      { itemId: "a", price: 7.5, store: "A" },
      { itemId: "a", price: 6.9, store: "B" },
      { itemId: "b", price: 3, store: "C" },
    ]);
    expect(m.get("a")).toMatchObject({ price: 6.9, store: "B" });
    expect(m.get("b")).toMatchObject({ price: 3 });
    expect(m.size).toBe(2);
  });
  it("first entry wins on a tie", () => {
    const m = cheapestByItem([
      { itemId: "a", price: 5, store: "first" },
      { itemId: "a", price: 5, store: "second" },
    ]);
    expect(m.get("a")).toMatchObject({ store: "first" });
  });
  it("empty → empty map", () => {
    expect(cheapestByItem([]).size).toBe(0);
  });
});
