import { describe, expect, it } from "vitest";
import {
  buildRecurringOccurrenceIso,
  isRecurringExpenseActiveForMonth,
  shiftMonthKey,
  TransactionPayloadSchema,
  TransactionType
} from "../src";

describe("recurring", () => {
  it("buildRecurringOccurrenceIso clamps the day to the last day of the month", () => {
    expect(buildRecurringOccurrenceIso("2026-02", 31)).toBe("2026-02-28T12:00:00.000Z");
    expect(buildRecurringOccurrenceIso("2028-02", 31)).toBe("2028-02-29T12:00:00.000Z");
  });

  it("isRecurringExpenseActiveForMonth respects start and archive months", () => {
    expect(
      isRecurringExpenseActiveForMonth({
        startMonth: "2026-03",
        archivedAt: null,
        monthKey: "2026-04"
      })
    ).toBe(true);

    expect(
      isRecurringExpenseActiveForMonth({
        startMonth: "2026-03",
        archivedAt: "2026-05-15T12:00:00.000Z",
        monthKey: "2026-05"
      })
    ).toBe(false);

    expect(
      isRecurringExpenseActiveForMonth({
        startMonth: "2026-03",
        archivedAt: "2026-05-15T12:00:00.000Z",
        monthKey: "2026-04"
      })
    ).toBe(true);
  });

  it("shiftMonthKey moves month boundaries across years", () => {
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
  });

  it("TransactionPayloadSchema requires complete recurring metadata for expense transactions", () => {
    const basePayload = {
      id: "11111111-1111-4111-8111-111111111111",
      walletId: "22222222-2222-4222-8222-222222222222",
      accountId: "33333333-3333-4333-8333-333333333333",
      type: TransactionType.EXPENSE,
      amountCents: 15990,
      occurredAt: "2026-03-29T12:00:00.000Z",
      description: "Plano de internet",
      categoryId: null,
      counterpartyAccountId: null,
      deletedAt: null
    };

    expect(
      TransactionPayloadSchema.safeParse({
        ...basePayload,
        recurringExpenseId: "44444444-4444-4444-8444-444444444444"
      }).success
    ).toBe(false);

    expect(
      TransactionPayloadSchema.safeParse({
        ...basePayload,
        recurringExpenseId: "44444444-4444-4444-8444-444444444444",
        recurringMonth: "2026-03"
      }).success
    ).toBe(true);

    expect(
      TransactionPayloadSchema.safeParse({
        ...basePayload,
        type: TransactionType.INCOME,
        recurringExpenseId: "44444444-4444-4444-8444-444444444444",
        recurringMonth: "2026-03"
      }).success
    ).toBe(false);
  });
});
