const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildRecurringOccurrenceIso,
  isRecurringExpenseActiveForMonth,
  shiftMonthKey,
  TransactionPayloadSchema,
  TransactionType
} = require("../dist");

test("buildRecurringOccurrenceIso clamps the day to the last day of the month", () => {
  assert.equal(buildRecurringOccurrenceIso("2026-02", 31), "2026-02-28T12:00:00.000Z");
  assert.equal(buildRecurringOccurrenceIso("2028-02", 31), "2028-02-29T12:00:00.000Z");
});

test("isRecurringExpenseActiveForMonth respects start and archive months", () => {
  assert.equal(
    isRecurringExpenseActiveForMonth({
      startMonth: "2026-03",
      archivedAt: null,
      monthKey: "2026-04"
    }),
    true
  );

  assert.equal(
    isRecurringExpenseActiveForMonth({
      startMonth: "2026-03",
      archivedAt: "2026-05-15T12:00:00.000Z",
      monthKey: "2026-05"
    }),
    false
  );

  assert.equal(
    isRecurringExpenseActiveForMonth({
      startMonth: "2026-03",
      archivedAt: "2026-05-15T12:00:00.000Z",
      monthKey: "2026-04"
    }),
    true
  );
});

test("shiftMonthKey moves month boundaries across years", () => {
  assert.equal(shiftMonthKey("2026-12", 1), "2027-01");
  assert.equal(shiftMonthKey("2026-01", -1), "2025-12");
});

test("TransactionPayloadSchema requires complete recurring metadata for expense transactions", () => {
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

  assert.equal(
    TransactionPayloadSchema.safeParse({
      ...basePayload,
      recurringExpenseId: "44444444-4444-4444-8444-444444444444"
    }).success,
    false
  );

  assert.equal(
    TransactionPayloadSchema.safeParse({
      ...basePayload,
      recurringExpenseId: "44444444-4444-4444-8444-444444444444",
      recurringMonth: "2026-03"
    }).success,
    true
  );

  assert.equal(
    TransactionPayloadSchema.safeParse({
      ...basePayload,
      type: TransactionType.INCOME,
      recurringExpenseId: "44444444-4444-4444-8444-444444444444",
      recurringMonth: "2026-03"
    }).success,
    false
  );
});
