import { describe, it, expect } from "vitest";
import { swapOrder } from "@/lib/reorder";

const list = [
  { id: "a", sortOrder: 1 },
  { id: "b", sortOrder: 2 },
  { id: "c", sortOrder: 3 },
];

describe("swapOrder", () => {
  it("moves a middle item up (swaps sortOrder with previous)", () => {
    const r = swapOrder(list, "b", "up");
    expect(r).toEqual([
      { id: "b", sortOrder: 1 },
      { id: "a", sortOrder: 2 },
    ]);
  });
  it("moves a middle item down", () => {
    const r = swapOrder(list, "b", "down");
    expect(r).toEqual([
      { id: "b", sortOrder: 3 },
      { id: "c", sortOrder: 2 },
    ]);
  });
  it("is a no-op at the top going up", () => {
    expect(swapOrder(list, "a", "up")).toEqual([]);
  });
  it("is a no-op at the bottom going down", () => {
    expect(swapOrder(list, "c", "down")).toEqual([]);
  });
  it("is a no-op for an unknown id", () => {
    expect(swapOrder(list, "zzz", "up")).toEqual([]);
  });
});
