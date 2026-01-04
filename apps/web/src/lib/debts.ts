import { db, DebtLocal, DebtStatus } from "./db";

type AuthFetch = (path: string, options?: RequestInit) => Promise<Response>;

type DebtResponse = {
  id: string;
  walletId: string;
  name: string;
  principalCents: number;
  interestRate: number | null;
  monthlyPaymentCents: number | null;
  startedAt: string;
  dueAt?: string | null;
  status: DebtStatus;
  updatedAt?: string;
  createdAt?: string;
};

export async function syncDebts(walletId: string, authFetch: AuthFetch) {
  const res = await authFetch(`/wallets/${walletId}/debts`);
  if (!res.ok) {
    throw new Error("Failed to load debts");
  }

  const data = (await res.json()) as DebtResponse[];
  const mapped: DebtLocal[] = data.map((debt) => ({
    id: debt.id,
    walletId: debt.walletId,
    name: debt.name,
    principalCents: debt.principalCents,
    interestRate: debt.interestRate ?? null,
    monthlyPaymentCents: debt.monthlyPaymentCents ?? null,
    startedAt: debt.startedAt,
    dueAt: debt.dueAt ?? null,
    status: debt.status,
    updatedAt: debt.updatedAt ?? debt.createdAt ?? new Date().toISOString()
  }));

  await db.transaction("rw", db.debts_local, async () => {
    await db.debts_local.where("walletId").equals(walletId).delete();
    await db.debts_local.bulkPut(mapped);
  });

  return mapped;
}
