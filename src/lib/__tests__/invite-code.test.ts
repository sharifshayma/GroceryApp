import { describe, it, expect } from "vitest";
import { generateInviteCode } from "@/lib/invite-code";

describe("generateInviteCode", () => {
  it("returns an 8-char lowercase alphanumeric code", () => {
    for (let i = 0; i < 50; i++) {
      const c = generateInviteCode();
      expect(c).toMatch(/^[a-z0-9]{8}$/);
    }
  });
  it("is highly unlikely to collide across many draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(generateInviteCode());
    expect(seen.size).toBeGreaterThan(495);
  });
});
