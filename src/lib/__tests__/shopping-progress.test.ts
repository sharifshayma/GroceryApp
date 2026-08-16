// src/lib/__tests__/shopping-progress.test.ts
import { describe, it, expect } from "vitest";
import { shoppingProgress } from "@/lib/shopping-progress";

describe("shoppingProgress", () => {
  it("counts bought and total", () => {
    expect(shoppingProgress([{ isBought: true }, { isBought: false }, { isBought: true }])).toEqual({
      bought: 2,
      total: 3,
    });
  });
  it("all bought", () => {
    expect(shoppingProgress([{ isBought: true }, { isBought: true }])).toEqual({ bought: 2, total: 2 });
  });
  it("none bought", () => {
    expect(shoppingProgress([{ isBought: false }])).toEqual({ bought: 0, total: 1 });
  });
  it("empty", () => {
    expect(shoppingProgress([])).toEqual({ bought: 0, total: 0 });
  });
});
