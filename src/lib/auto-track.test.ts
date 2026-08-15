import { describe, it, expect } from "vitest";
import { computeAutoTrack } from "./auto-track";

const base = { autoTrackStock: true, stockUpdated: false, quantity: 2 };

describe("computeAutoTrack", () => {
  it("marking bought (tracked, not yet counted) → +quantity, stockUpdated true", () => {
    expect(computeAutoTrack({ ...base, isBought: true })).toEqual({ stockDelta: 2, stockUpdated: true });
  });
  it("un-marking (was counted) → -quantity, stockUpdated false", () => {
    expect(computeAutoTrack({ ...base, isBought: false, stockUpdated: true })).toEqual({ stockDelta: -2, stockUpdated: false });
  });
  it("autoTrackStock off → no stock change on mark", () => {
    expect(computeAutoTrack({ ...base, isBought: true, autoTrackStock: false })).toEqual({ stockDelta: null, stockUpdated: false });
  });
  it("already counted, marking bought again → no double-count", () => {
    expect(computeAutoTrack({ ...base, isBought: true, stockUpdated: true })).toEqual({ stockDelta: null, stockUpdated: true });
  });
  it("un-marking something never counted → no refund", () => {
    expect(computeAutoTrack({ ...base, isBought: false, stockUpdated: false })).toEqual({ stockDelta: null, stockUpdated: false });
  });
});
