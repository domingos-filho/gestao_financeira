import { describe, expect, it } from "vitest";
import { toTimestamp } from "../src/datetime";

describe("toTimestamp", () => {
  it("returns null for empty values", () => {
    expect(toTimestamp(null)).toBeNull();
    expect(toTimestamp(undefined)).toBeNull();
    expect(toTimestamp("")).toBeNull();
    expect(toTimestamp("   ")).toBeNull();
  });

  it("normalizes date inputs", () => {
    expect(toTimestamp(new Date("2024-01-02T03:04:05.000Z"))).toBe(1704164645000);
    expect(toTimestamp("2024-01-02T03:04:05.000Z")).toBe(1704164645000);
    expect(toTimestamp(1704164645000)).toBe(1704164645000);
  });

  it("rejects invalid values", () => {
    expect(toTimestamp(Number.NaN)).toBeNull();
    expect(toTimestamp(Number.POSITIVE_INFINITY)).toBeNull();
    expect(toTimestamp("not-a-date")).toBeNull();
  });
});
