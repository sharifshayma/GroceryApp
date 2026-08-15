import { describe, it, expect } from "vitest";
import { isBlobUrl } from "./blob";

describe("isBlobUrl", () => {
  it("true for a Vercel Blob URL", () => {
    expect(isBlobUrl("https://abc123.public.blob.vercel-storage.com/items/x.jpg")).toBe(true);
  });
  it("false for a Supabase storage URL", () => {
    expect(isBlobUrl("https://wvuazvbcraztswoxfbwi.supabase.co/storage/v1/object/public/i/x.jpg")).toBe(false);
  });
  it("false for junk / empty", () => {
    expect(isBlobUrl("")).toBe(false);
    expect(isBlobUrl("not a url")).toBe(false);
  });
});
