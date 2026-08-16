import { describe, it, expect } from "vitest";
import { formatListDate } from "./format-list-date";

const NOW = Date.UTC(2026, 7, 16, 12, 0, 0); // 2026-08-16 (fixed, no Date.now())

describe("formatListDate", () => {
  it("returns Today for same day", () => {
    expect(formatListDate(new Date(Date.UTC(2026, 7, 16, 8)).toISOString(), "en", NOW)).toBe("Today");
    expect(formatListDate(new Date(Date.UTC(2026, 7, 16, 8)).toISOString(), "he", NOW)).toBe("היום");
  });
  it("returns Yesterday for the prior day", () => {
    expect(formatListDate(new Date(Date.UTC(2026, 7, 15, 8)).toISOString(), "en", NOW)).toBe("Yesterday");
    expect(formatListDate(new Date(Date.UTC(2026, 7, 15, 8)).toISOString(), "he", NOW)).toBe("אתמול");
  });
  it("returns a localized date for older", () => {
    expect(formatListDate(new Date(Date.UTC(2026, 7, 1, 8)).toISOString(), "en", NOW)).toMatch(/Aug/);
  });
});
