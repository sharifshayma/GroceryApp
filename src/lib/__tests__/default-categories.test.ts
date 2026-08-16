import { describe, it, expect } from "vitest";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";

describe("DEFAULT_CATEGORIES", () => {
  it("has 21 bilingual categories with unique names", () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(21);
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.name)).size).toBe(21);
    for (const c of DEFAULT_CATEGORIES) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.nameHe.length).toBeGreaterThan(0);
      expect(c.emoji.length).toBeGreaterThan(0);
    }
  });
});
