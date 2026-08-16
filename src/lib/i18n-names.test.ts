import { describe, it, expect } from "vitest";
import { getItemName, getCategoryName } from "./i18n-names";

describe("getItemName", () => {
  it("returns English name in en", () => {
    expect(getItemName({ name: "Milk", nameHe: "חלב" }, "en")).toBe("Milk");
  });
  it("returns Hebrew name in he", () => {
    expect(getItemName({ name: "Milk", nameHe: "חלב" }, "he")).toBe("חלב");
  });
  it("falls back to name in he when nameHe missing/empty", () => {
    expect(getItemName({ name: "Milk", nameHe: null }, "he")).toBe("Milk");
    expect(getItemName({ name: "Milk", nameHe: "" }, "he")).toBe("Milk");
    expect(getItemName({ name: "Milk" }, "he")).toBe("Milk");
  });
});

describe("getCategoryName", () => {
  it("mirrors getItemName behavior", () => {
    expect(getCategoryName({ name: "Dairy", nameHe: "מוצרי חלב" }, "he")).toBe("מוצרי חלב");
    expect(getCategoryName({ name: "Dairy", nameHe: null }, "he")).toBe("Dairy");
    expect(getCategoryName({ name: "Dairy", nameHe: "x" }, "en")).toBe("Dairy");
  });
});
