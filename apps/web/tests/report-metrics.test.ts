import { describe, expect, it } from "vitest";
import { TransactionType } from "@gf/shared";
import {
  buildReportBuckets,
  calculatePercentChange,
  getPreviousRange,
  getRangeFromBuckets,
  summarizeTransactions
} from "../src/lib/report-metrics";

describe("report metrics", () => {
  it("builds the expected number of buckets for each period", () => {
    expect(buildReportBuckets("day")).toHaveLength(14);
    expect(buildReportBuckets("week")).toHaveLength(12);
    expect(buildReportBuckets("month")).toHaveLength(12);
    expect(buildReportBuckets("year")).toHaveLength(5);
  });

  it("builds a previous range with the same duration as the current range", () => {
    const buckets = buildReportBuckets("month", new Date("2026-07-04T12:00:00.000Z"));
    const currentRange = getRangeFromBuckets(buckets);
    const previousRange = getPreviousRange(currentRange);

    expect(currentRange.end.getTime() - currentRange.start.getTime()).toBe(
      previousRange.end.getTime() - previousRange.start.getTime()
    );
    expect(previousRange.end.getTime()).toBe(currentRange.start.getTime());
  });

  it("summarizes income, expense and net correctly", () => {
    const summary = summarizeTransactions([
      {
        type: TransactionType.INCOME,
        amountCents: 12000,
        occurredAt: "2026-06-10T00:00:00.000Z"
      },
      {
        type: TransactionType.EXPENSE,
        amountCents: 3500,
        occurredAt: "2026-06-11T00:00:00.000Z"
      }
    ]);

    expect(summary).toEqual({
      income: 12000,
      expense: 3500,
      net: 8500
    });
  });

  it("returns null percent change when the previous value is zero", () => {
    expect(calculatePercentChange(100, 0)).toBeNull();
  });
});
