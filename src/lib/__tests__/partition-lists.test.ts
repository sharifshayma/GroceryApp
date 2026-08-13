import { describe, it, expect } from "vitest";
import { partitionLists } from "@/lib/partition-lists";

const lists = [
  { id: "a", status: "draft" },
  { id: "b", status: "completed" },
  { id: "c", status: "active" },
  { id: "d", status: "completed" },
];

describe("partitionLists", () => {
  it("splits into open (draft|active) and completed, preserving order", () => {
    const { open, completed } = partitionLists(lists);
    expect(open.map((l) => l.id)).toEqual(["a", "c"]);
    expect(completed.map((l) => l.id)).toEqual(["b", "d"]);
  });
  it("handles empty input", () => {
    expect(partitionLists([])).toEqual({ open: [], completed: [] });
  });
});
