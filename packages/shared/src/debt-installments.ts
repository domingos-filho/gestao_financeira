export type DebtInstallmentPlan = {
  installmentAmounts: number[];
  installmentDates: string[];
  monthlyPaymentCents: number;
  totalCents: number;
};

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function toUtcNoonDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

function addMonthsKeepingDay(baseDate: Date, monthsOffset: number) {
  const year = baseDate.getUTCFullYear();
  const monthIndex = baseDate.getUTCMonth() + monthsOffset;
  const dayOfMonth = baseDate.getUTCDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(year, monthIndex + 1, 0, 12, 0, 0)).getUTCDate();
  const targetDay = Math.min(dayOfMonth, lastDayOfTargetMonth);
  return toUtcNoonDate(year, monthIndex, targetDay);
}

export function splitAmountIntoInstallments(totalCents: number, installmentCount: number) {
  assertPositiveInteger(totalCents, "totalCents");
  assertPositiveInteger(installmentCount, "installmentCount");

  if (installmentCount > totalCents) {
    throw new Error("installmentCount cannot exceed totalCents");
  }

  const baseAmount = Math.floor(totalCents / installmentCount);
  const remainder = totalCents % installmentCount;

  return Array.from({ length: installmentCount }, (_, index) => baseAmount + (index < remainder ? 1 : 0));
}

export function calculateMonthlyPaymentCents(totalCents: number, installmentCount: number) {
  assertPositiveInteger(totalCents, "totalCents");
  assertPositiveInteger(installmentCount, "installmentCount");

  if (installmentCount > totalCents) {
    throw new Error("installmentCount cannot exceed totalCents");
  }

  return Math.round(totalCents / installmentCount);
}

export function buildMonthlyInstallmentDates(startedAt: string, installmentCount: number) {
  assertPositiveInteger(installmentCount, "installmentCount");

  const baseDate = new Date(startedAt);
  if (Number.isNaN(baseDate.getTime())) {
    throw new Error("startedAt must be a valid date");
  }

  return Array.from({ length: installmentCount }, (_, index) =>
    addMonthsKeepingDay(baseDate, index).toISOString()
  );
}

export function buildDebtInstallmentPlan(params: {
  totalCents: number;
  installmentCount: number;
  startedAt: string;
}): DebtInstallmentPlan {
  const installmentAmounts = splitAmountIntoInstallments(params.totalCents, params.installmentCount);
  const installmentDates = buildMonthlyInstallmentDates(params.startedAt, params.installmentCount);

  return {
    installmentAmounts,
    installmentDates,
    monthlyPaymentCents: calculateMonthlyPaymentCents(params.totalCents, params.installmentCount),
    totalCents: installmentAmounts.reduce((sum, amount) => sum + amount, 0)
  };
}
