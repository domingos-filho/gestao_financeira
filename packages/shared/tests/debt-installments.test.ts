import { describe, expect, it } from "vitest";
import {
  buildDebtInstallmentPlan,
  buildMonthlyInstallmentDates,
  calculateMonthlyPaymentCents,
  splitAmountIntoInstallments
} from "../src/debt-installments";

describe("debt-installments", () => {
  it("splits cents evenly and distributes the remainder first", () => {
    expect(splitAmountIntoInstallments(1000, 3)).toEqual([334, 333, 333]);
    expect(splitAmountIntoInstallments(1200, 12)).toEqual(Array(12).fill(100));
  });

  it("builds monthly dates while keeping the day close to the start date", () => {
    const dates = buildMonthlyInstallmentDates("2026-01-31T12:00:00.000Z", 3).map((date) =>
      date.slice(0, 10)
    );

    expect(dates).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("builds a consistent installment plan", () => {
    const plan = buildDebtInstallmentPlan({
      totalCents: 2500,
      installmentCount: 4,
      startedAt: "2026-06-15T12:00:00.000Z"
    });

    expect(plan.monthlyPaymentCents).toBe(calculateMonthlyPaymentCents(2500, 4));
    expect(plan.totalCents).toBe(2500);
    expect(plan.installmentAmounts).toHaveLength(4);
    expect(plan.installmentDates).toHaveLength(4);
    expect(plan.installmentAmounts.reduce((sum, amount) => sum + amount, 0)).toBe(2500);
  });
});
