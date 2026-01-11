"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/lib/auth";
import { db, safeDexie, DebtStatus } from "@/lib/db";
import { syncDebts } from "@/lib/debts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatBRL(amountCents: number) {
  return (amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function DebtsPage({ params }: { params: { walletId: string } }) {
  const { walletId } = params;
  const { authFetch } = useAuth();
  const debts = useLiveQuery(
    () => safeDexie(() => db.debts_local.where("walletId").equals(walletId).toArray(), []),
    [walletId]
  );

  const [name, setName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [startedAt, setStartedAt] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [dueAt, setDueAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.onLine) return;
    syncDebts(walletId, authFetch).catch(() => null);
  }, [authFetch, walletId]);

  const totals = useMemo(() => {
    const active = (debts ?? []).filter((debt) => debt.status === "ACTIVE");
    const totalDebt = active.reduce((sum, debt) => sum + debt.principalCents, 0);
    const totalMonthly = active.reduce((sum, debt) => sum + (debt.monthlyPaymentCents ?? 0), 0);
    return { totalDebt, totalMonthly };
  }, [debts]);

  const handleCreate = async () => {
    setMessage(null);
    if (!name.trim()) {
      setMessage("Informe o nome.");
      return;
    }
    const principalValue = Number(principal.replace(",", "."));
    if (!principalValue || principalValue <= 0) {
      setMessage("Informe o valor principal.");
      return;
    }
    const principalCents = Math.round(principalValue * 100);
    const interestValue = interestRate ? Number(interestRate.replace(",", ".")) : null;
    const paymentValue = monthlyPayment ? Number(monthlyPayment.replace(",", ".")) : null;

    const res = await authFetch(`/wallets/${walletId}/debts`, {
      method: "POST",
      body: JSON.stringify({
        name,
        principalCents,
        interestRate: interestValue ?? undefined,
        monthlyPaymentCents: paymentValue ? Math.round(paymentValue * 100) : undefined,
        startedAt: new Date(startedAt).toISOString(),
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined
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
      startedAt: data.startedAt,
      dueAt: data.dueAt ?? null,
      status: data.status,
      updatedAt: data.updatedAt ?? new Date().toISOString()
    });

    setName("");
    setPrincipal("");
    setInterestRate("");
    setMonthlyPayment("");
    setDueAt("");
    setMessage("Divida cadastrada.");
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
            <Input value={monthlyPayment} onChange={(event) => setMonthlyPayment(event.target.value)} inputMode="decimal" />
          </div>
          <div className="space-y-2">
            <Label>Inicio</Label>
            <Input type="date" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Vencimento (opcional)</Label>
            <Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </div>
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
              <div>
                <p className="font-medium">{debt.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBRL(debt.principalCents)} • {debt.status}
                </p>
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
