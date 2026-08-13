import { describe, it, expect } from "vitest";
import { groupTagsByType } from "@/lib/group-tags";

const tags = [
  { id: "1", type: "custom" },
  { id: "2", type: "recipe" },
  { id: "3", type: "store" },
  { id: "4", type: "recipe" },
];

describe("groupTagsByType", () => {
  it("groups in fixed order recipe, store, custom", () => {
    const g = groupTagsByType(tags);
    expect(g.map((x) => x.type)).toEqual(["recipe", "store", "custom"]);
    expect(g[0].tags.map((t) => t.id)).toEqual(["2", "4"]);
    expect(g[1].tags.map((t) => t.id)).toEqual(["3"]);
    expect(g[2].tags.map((t) => t.id)).toEqual(["1"]);
  });
  it("drops empty groups", () => {
    const g = groupTagsByType([{ id: "1", type: "store" }]);
    expect(g.map((x) => x.type)).toEqual(["store"]);
  });
  it("returns [] for no tags", () => {
    expect(groupTagsByType([])).toEqual([]);
  });
});
