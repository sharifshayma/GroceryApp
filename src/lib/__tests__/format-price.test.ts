import { describe, it, expect } from "vitest";
import { formatPrice } from "@/lib/format-price";

describe("formatPrice", () => {
  it("formats ILS with the shekel symbol + 2 decimals", () => {
    expect(formatPrice(6.9, "ILS")).toBe("₪6.90");
    expect(formatPrice(12, "ILS")).toBe("₪12.00");
  });
  it("USD/EUR symbols", () => {
    expect(formatPrice(3.5, "USD")).toBe("$3.50");
    expect(formatPrice(3.5, "EUR")).toBe("€3.50");
  });
  it("unknown currency → no symbol", () => {
    expect(formatPrice(3.5, "ZZZ")).toBe("3.50");
  });
});
