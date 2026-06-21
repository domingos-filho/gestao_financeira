import { buildDebtInstallmentPlan } from "@gf/shared";

export type DebtInstallmentLaunch = {
  amountCents: number;
  occurredAt: string;
  description: string;
};

export function buildDebtInstallmentLaunches(params: {
  name: string;
  totalCents: number;
  installmentCount: number;
  startedAt: string;
}) {
  const plan = buildDebtInstallmentPlan({
    totalCents: params.totalCents,
    installmentCount: params.installmentCount,
    startedAt: params.startedAt
  });

  const name = params.name.trim();
  const launches: DebtInstallmentLaunch[] = plan.installmentAmounts.map((amountCents, index) => ({
    amountCents,
    occurredAt: plan.installmentDates[index] ?? plan.installmentDates[plan.installmentDates.length - 1] ?? params.startedAt,
    description: `${name} - Parcela ${index + 1}/${params.installmentCount}`
  }));

  return { plan, launches };
}
