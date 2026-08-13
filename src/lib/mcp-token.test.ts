import { describe, it, expect } from "vitest";
import { generateRawToken, hashToken, lastFour } from "./mcp-token";

describe("hashToken", () => {
  it("is deterministic for the same input", () => {
    expect(hashToken("grocery_abc")).toBe(hashToken("grocery_abc"));
  });
  it("differs for different inputs", () => {
    expect(hashToken("grocery_abc")).not.toBe(hashToken("grocery_abd"));
  });
  it("returns a 64-char hex string (sha256)", () => {
    expect(hashToken("grocery_abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("generateRawToken", () => {
  it("has the grocery_ prefix and is long", () => {
    const t = generateRawToken();
    expect(t.startsWith("grocery_")).toBe(true);
    expect(t.length).toBeGreaterThan(24);
  });
  it("is unique across calls", () => {
    expect(generateRawToken()).not.toBe(generateRawToken());
  });
});

describe("lastFour", () => {
  it("returns the last four chars", () => {
    expect(lastFour("grocery_abcdef")).toBe("cdef");
  });
});
