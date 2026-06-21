import { describe, expect, it, vi } from "vitest";
import { resolvePeriod } from "../src/lib/period-filter";

describe("resolvePeriod", () => {
  it("uses the current month when the filter does not define a range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-05-15T12:00:00Z"));

    const period = resolvePeriod({ month: "invalid", from: null, to: null });

    expect(period.isRange).toBe(false);
    expect(period.start.getFullYear()).toBe(2024);
    expect(period.start.getMonth()).toBe(4);
    expect(period.start.getDate()).toBe(1);
    expect(period.start.getHours()).toBe(0);
    expect(period.end.getFullYear()).toBe(2024);
    expect(period.end.getMonth()).toBe(5);
    expect(period.end.getDate()).toBe(1);
    expect(period.end.getHours()).toBe(0);

    vi.useRealTimers();
  });

  it("resolves a custom range as an exclusive end date", () => {
    const period = resolvePeriod({
      month: "2024-05",
      from: "2024-05-10",
      to: "2024-05-12"
    });

    expect(period.isRange).toBe(true);
    expect(period.start.getFullYear()).toBe(2024);
    expect(period.start.getMonth()).toBe(4);
    expect(period.start.getDate()).toBe(10);
    expect(period.start.getHours()).toBe(0);
    expect(period.end.getFullYear()).toBe(2024);
    expect(period.end.getMonth()).toBe(4);
    expect(period.end.getDate()).toBe(13);
    expect(period.end.getHours()).toBe(0);
  });
});
