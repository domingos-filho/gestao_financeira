"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { TransactionType } from "@gf/shared";
import { useAuth } from "@/lib/auth";
import { buildDebtInstallmentLaunches } from "@/lib/debt-installments";
import { getDeviceId } from "@/lib/device";
import { db, safeDexie, DebtStatus } from "@/lib/db";
import { syncDebts } from "@/lib/debts";
import { createLocalTransaction, syncNow } from "@/lib/sync";
import { useWalletAccounts } from "@/lib/wallets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatBRL(amountCents: number) {
  return (amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseMoneyToCents(value: string) {
  const normalized = Number(value.replace(",", "."));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }
  return Math.round(normalized * 100);
}

function toIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return new Date().toISOString();
  }
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
}

export default function DebtsPage({ params }: { params: { walletId: string } }) {
  const { walletId } = params;
  const { user, authFetch } = useAuth();
  const { accounts, isLoading: accountsLoading } = useWalletAccounts(walletId);
  const debts = useLiveQuery(
    () => safeDexie(() => db.debts_local.where("walletId").equals(walletId).toArray(), []),
    [walletId]
  );

  const [name, setName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [installmentCount, setInstallmentCount] = useState("");
  const [startedAt, setStartedAt] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [dueAt, setDueAt] = useState("");
  const [accountId, setAccountId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const safeAccounts = useMemo(
    () => accounts.filter((account) => account && account.id && account.name),
    [accounts]
  );

  const principalCents = useMemo(() => parseMoneyToCents(principal), [principal]);
  const monthlyPaymentInputCents = useMemo(() => parseMoneyToCents(monthlyPayment), [monthlyPayment]);
  const installmentCountValue = useMemo(() => {
    const normalized = Number(installmentCount.replace(/[^\d]/g, ""));
    return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
  }, [installmentCount]);

  const installmentPreview = useMemo(() => {
    if (!principalCents || !installmentCountValue) {
      return null;
    }

    try {
      return buildDebtInstallmentLaunches({
        name: name.trim() || "Divida",
        totalCents: principalCents,
        installmentCount: installmentCountValue,
        startedAt: toIsoDate(startedAt)
      });
    } catch {
      return null;
    }
  }, [name, installmentCountValue, principalCents, startedAt]);

  useEffect(() => {
    if (!navigator.onLine) {
      return;
    }
    syncDebts(walletId, authFetch).catch(() => null);
  }, [authFetch, walletId]);

  useEffect(() => {
    if (safeAccounts.length === 0) {
      setAccountId("");
      return;
    }

    if (!safeAccounts.some((account) => account.id === accountId)) {
      setAccountId(safeAccounts[0]?.id ?? "");
    }
  }, [accountId, safeAccounts]);

  const totals = useMemo(() => {
    const active = (debts ?? []).filter((debt) => debt.status === "ACTIVE");
    const totalDebt = active.reduce((sum, debt) => sum + debt.principalCents, 0);
    const totalMonthly = active.reduce((sum, debt) => sum + (debt.monthlyPaymentCents ?? 0), 0);
    return { totalDebt, totalMonthly };
  }, [debts]);

  const handleCreate = async () => {
    setMessage(null);

    if (!user) {
      setMessage("Usuario nao autenticado.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setMessage("Informe o nome.");
      return;
    }

    if (!principalCents) {
      setMessage("Informe o valor principal.");
      return;
    }

    if (installmentCountValue && installmentCountValue > principalCents) {
      setMessage("Quantidade de parcelas muito alta para o valor informado.");
      return;
    }

    if (installmentCountValue && safeAccounts.length === 0) {
      setMessage("Crie uma conta para gerar as parcelas.");
      return;
    }

    if (installmentCountValue && !accountId) {
      setMessage("Selecione uma conta para os lancamentos.");
      return;
    }

    const interestValue = interestRate ? Number(interestRate.replace(",", ".")) : null;
    const startedAtIso = toIsoDate(startedAt);
    const dueAtIso = dueAt ? toIsoDate(dueAt) : undefined;
    let installmentSchedule: ReturnType<typeof buildDebtInstallmentLaunches> | null = null;
    if (installmentCountValue) {
      installmentSchedule = buildDebtInstallmentLaunches({
        name: trimmedName,
        totalCents: principalCents,
        installmentCount: installmentCountValue,
        startedAt: startedAtIso
      });
    }

    const monthlyPaymentCents = installmentCountValue
      ? installmentSchedule?.plan.monthlyPaymentCents ?? null
      : monthlyPaymentInputCents;

    const res = await authFetch(`/wallets/${walletId}/debts`, {
      method: "POST",
      body: JSON.stringify({
        name: trimmedName,
        principalCents,
        interestRate: interestValue ?? undefined,
        monthlyPaymentCents: monthlyPaymentCents ?? undefined,
        installmentCount: installmentCountValue ?? undefined,
        startedAt: startedAtIso,
        dueAt: dueAtIso
      })
    });

    if (!res.ok) {
      setMessage("Nao foi possivel salvar.");
      return;
    }

    const data = (await res.json()) as {
      id: string;
      walletId: string;
      name: string;
      principalCents: number;
      interestRate: number | null;
      monthlyPaymentCents: number | null;
      installmentCount: number | null;
      startedAt: string;
      dueAt?: string | null;
      status: DebtStatus;
      updatedAt: string;
    };

    await db.debts_local.put({
      id: data.id,
      walletId: data.walletId,
      name: data.name,
      principalCents: data.principalCents,
      interestRate: data.interestRate ?? null,
      monthlyPaymentCents: data.monthlyPaymentCents ?? null,
      installmentCount: data.installmentCount ?? null,
      startedAt: data.startedAt,
      dueAt: data.dueAt ?? null,
      status: data.status,
      updatedAt: data.updatedAt ?? new Date().toISOString()
    });

    if (installmentSchedule) {
      for (const launch of installmentSchedule.launches) {
        await createLocalTransaction({
          walletId,
          accountId,
          type: TransactionType.EXPENSE,
          amountCents: launch.amountCents,
          occurredAt: launch.occurredAt,
          description: launch.description,
          categoryId: null,
          counterpartyAccountId: null,
          userId: user.id,
          deviceId: getDeviceId()
        });
      }

      await syncNow({
        walletId,
        userId: user.id,
        deviceId: getDeviceId(),
        authFetch
      }).catch(() => null);
    }

    setName("");
    setPrincipal("");
    setInterestRate("");
    setMonthlyPayment("");
    setInstallmentCount("");
    setDueAt("");
    setMessage(installmentSchedule ? "Divida cadastrada e parcelas geradas." : "Divida cadastrada.");
  };

  const handleStatus = async (debtId: string, status: DebtStatus) => {
    const res = await authFetch(`/wallets/${walletId}/debts/${debtId}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });

    if (!res.ok) {
      setMessage("Nao foi possivel atualizar.");
      return;
    }

    const data = (await res.json()) as { id: string; status: DebtStatus; updatedAt: string };
    await db.debts_local.update(data.id, { status: data.status, updatedAt: data.updatedAt });
  };

  const selectedAccountName = safeAccounts.find((account) => account.id === accountId)?.name ?? "";

  return (
    <div className="grid gap-6 animate-rise">
      <div>
        <h1 className="text-2xl font-semibold">Dividas</h1>
        <p className="text-sm text-muted-foreground">Acompanhe suas dividas e compromissos</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total em aberto</CardTitle>
            <CardDescription>Soma das dividas ativas</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatBRL(totals.totalDebt)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Compromisso mensal</CardTitle>
            <CardDescription>Pagamentos mensais previstos</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatBRL(totals.totalMonthly)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adicionar Divida</CardTitle>
          <CardDescription>Registre financiamentos, cartoes ou emprestimos</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Valor principal (R$)</Label>
            <Input value={principal} onChange={(event) => setPrincipal(event.target.value)} inputMode="decimal" />
          </div>
          <div className="space-y-2">
            <Label>Juros anuais (%)</Label>
            <Input value={interestRate} onChange={(event) => setInterestRate(event.target.value)} inputMode="decimal" />
          </div>
          <div className="space-y-2">
            <Label>Pagamento mensal (R$)</Label>
            <Input
              value={monthlyPayment}
              onChange={(event) => setMonthlyPayment(event.target.value)}
              inputMode="decimal"
              disabled={Boolean(installmentCountValue)}
              placeholder={installmentCountValue ? "Calculado automaticamente" : "Opcional"}
            />
            {installmentPreview && (
              <p className="text-xs text-muted-foreground">
                Valor estimado por parcela: <strong className="text-foreground">{formatBRL(installmentPreview.plan.monthlyPaymentCents)}</strong>
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Quantidade de parcelas</Label>
            <Input
              value={installmentCount}
              onChange={(event) => setInstallmentCount(event.target.value)}
              inputMode="numeric"
              placeholder="Ex: 12"
            />
            <p className="text-xs text-muted-foreground">
              Quando preenchido, o app gera automaticamente os lancamentos mensais.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Inicio</Label>
            <Input type="date" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Vencimento (opcional)</Label>
            <Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </div>

          {installmentCountValue ? (
            <div className="md:col-span-2 space-y-2">
              <Label>Conta para os lancamentos</Label>
              {accountsLoading ? (
                <p className="text-sm text-muted-foreground">Carregando contas...</p>
              ) : safeAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Crie uma conta antes de gerar parcelas.</p>
              ) : (
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {safeAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedAccountName && (
                <p className="text-xs text-muted-foreground">
                  Os lancamentos serao enviados para <strong className="text-foreground">{selectedAccountName}</strong>.
                </p>
              )}
            </div>
          ) : null}

          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button variant="create" onClick={handleCreate}>
              Salvar
            </Button>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suas Dividas</CardTitle>
          <CardDescription>Atualize o status conforme os pagamentos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(debts ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma divida cadastrada.</p>}
          {(debts ?? []).map((debt) => (
            <div
              key={debt.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-1">
                <p className="font-medium">{debt.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBRL(debt.principalCents)} • {debt.status}
                </p>
                {debt.installmentCount ? (
                  <p className="text-xs text-muted-foreground">
                    Parcelado em {debt.installmentCount}x de{" "}
                    <strong className="text-foreground">
                      {formatBRL(debt.monthlyPaymentCents ?? Math.round(debt.principalCents / debt.installmentCount))}
                    </strong>
                  </p>
                ) : debt.monthlyPaymentCents ? (
                  <p className="text-xs text-muted-foreground">
                    Compromisso mensal de <strong className="text-foreground">{formatBRL(debt.monthlyPaymentCents)}</strong>
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {debt.status !== "PAID" && (
                  <Button variant="outline" onClick={() => handleStatus(debt.id, "PAID")}>
                    Marcar como pago
                  </Button>
                )}
                {debt.status !== "ACTIVE" && (
                  <Button onClick={() => handleStatus(debt.id, "ACTIVE")}>Reativar</Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
