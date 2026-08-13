import { describe, it, expect } from "vitest";
import { getDictionary, t, dirFor } from "@/i18n";

describe("i18n", () => {
  it("resolves a dotted key in both languages", () => {
    expect(t(getDictionary("en"), "auth.login.title")).toBe("Log in");
    expect(typeof t(getDictionary("he"), "auth.login.title")).toBe("string");
  });
  it("interpolates vars", () => {
    // 'common.greeting' = "Hi, {name}" in en
    expect(t(getDictionary("en"), "common.greeting", { name: "Sam" })).toBe("Hi, Sam");
  });
  it("returns the key path when missing", () => {
    expect(t(getDictionary("en"), "does.not.exist")).toBe("does.not.exist");
  });
  it("maps he to rtl and en to ltr", () => {
    expect(dirFor("he")).toBe("rtl");
    expect(dirFor("en")).toBe("ltr");
  });
});
