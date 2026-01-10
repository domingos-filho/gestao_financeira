"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { TransactionType } from "@gf/shared";
import { ArrowDownRight, ArrowUpRight, List, Plus, Repeat, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { db, safeDexie } from "@/lib/db";
import { formatDate, parseDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuickTransactionForm } from "@/components/quick-transaction-form";

function formatBRL(amountCents: number) {
  return (amountCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

export default function WalletDashboard({ params }: { params: { walletId: string } }) {
  const { walletId } = params;

  const transactions = useLiveQuery(
    () =>
      safeDexie(
        () => db.transactions_local.where("walletId").equals(walletId).and((tx) => !tx.deletedAt).toArray(),
        []
      ),
    [walletId]
  );

  type Summary = {
    income: number;
    expense: number;
    net: number;
    recent: NonNullable<typeof transactions>;
  };

  const monthSummary = useMemo<Summary>(() => {
    if (!transactions) {
      return { income: 0, expense: 0, net: 0, recent: [] };
    }

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    let income = 0;
    let expense = 0;
    const filtered = transactions.filter((tx) => {
      const occurred = parseDate(tx.occurredAt);
      return occurred ? occurred >= start && occurred < end : false;
    });

    for (const tx of filtered) {
      if (tx.type === TransactionType.INCOME) income += tx.amountCents;
      if (tx.type === TransactionType.EXPENSE) expense += tx.amountCents;
    }

    const recent = [...filtered].sort((a, b) => (b.occurredAt ?? "").localeCompare(a.occurredAt ?? "")).slice(0, 5);

    return {
      income,
      expense,
      net: income - expense,
      recent
    };
  }, [transactions]);

  const previousSummary = useMemo(() => {
    if (!transactions) {
      return { income: 0, expense: 0 };
    }
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);

    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      const occurred = parseDate(tx.occurredAt);
      if (occurred && occurred >= start && occurred < end) {
        if (tx.type === TransactionType.INCOME) income += tx.amountCents;
        if (tx.type === TransactionType.EXPENSE) expense += tx.amountCents;
      }
    }
    return { income, expense };
  }, [transactions]);

  const incomeDelta =
    previousSummary.income > 0
      ? ((monthSummary.income - previousSummary.income) / previousSummary.income) * 100
      : null;
  const expenseDelta =
    previousSummary.expense > 0
      ? ((monthSummary.expense - previousSummary.expense) / previousSummary.expense) * 100
      : null;

  const budgetTarget = monthSummary.income;
  const budgetUsed = monthSummary.expense;
  const budgetPct = budgetTarget ? Math.min(100, Math.round((budgetUsed / budgetTarget) * 100)) : 0;

  return (
    <div className="grid gap-6 animate-rise">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visao geral das suas financas pessoais</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Receitas</span>
              <TrendingUp className="h-4 w-4 text-[var(--color-success)]" />
            </div>
            <CardTitle className="text-xl text-[var(--color-success)]">{formatBRL(monthSummary.income)}</CardTitle>
            <CardDescription
              className={
                incomeDelta === null
                  ? "text-muted-foreground"
                  : incomeDelta >= 0
                  ? "text-[var(--color-success)]"
                  : "text-[var(--color-danger)]"
              }
            >
              {incomeDelta === null ? "Sem comparacao" : `${incomeDelta.toFixed(1)}% em relacao ao mes passado`}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Despesas</span>
              <TrendingDown className="h-4 w-4 text-[var(--color-danger)]" />
            </div>
            <CardTitle className="text-xl text-[var(--color-danger)]">{formatBRL(monthSummary.expense)}</CardTitle>
            <CardDescription
              className={
                expenseDelta === null
                  ? "text-muted-foreground"
                  : expenseDelta <= 0
                  ? "text-[var(--color-success)]"
                  : "text-[var(--color-danger)]"
              }
            >
              {expenseDelta === null ? "Sem comparacao" : `${expenseDelta.toFixed(1)}% em relacao ao mes passado`}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Saldo</span>
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-xl">{formatBRL(monthSummary.net)}</CardTitle>
            <CardDescription>Diferenca entre receitas e despesas</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Orcamento</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {budgetPct}%
              </span>
            </div>
            <CardTitle className="text-xl">{formatBRL(budgetUsed)}</CardTitle>
            <CardDescription>{formatBRL(budgetTarget)} planejado</CardDescription>
            <div className="h-2 w-full rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${budgetPct}%` }} />
            </div>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Nova Transacao</CardTitle>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardDescription>Registro rapido para o dia a dia</CardDescription>
          </CardHeader>
          <CardContent>
            <QuickTransactionForm walletId={walletId} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Transacoes Recentes</CardTitle>
              <List className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardDescription>Ultimos registros deste mes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {monthSummary.recent.length === 0 && <p className="text-sm text-muted-foreground">Sem transacoes.</p>}
            {monthSummary.recent.map((tx) => {
              const Icon =
                tx.type === TransactionType.EXPENSE
                  ? ArrowDownRight
                  : tx.type === TransactionType.TRANSFER
                  ? Repeat
                  : ArrowUpRight;
              const color =
                tx.type === TransactionType.EXPENSE
                  ? "text-[var(--color-danger)]"
                  : tx.type === TransactionType.TRANSFER
                  ? "text-[var(--color-info)]"
                  : "text-[var(--color-success)]";
              const badge =
                tx.type === TransactionType.EXPENSE
                  ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                  : tx.type === TransactionType.TRANSFER
                  ? "bg-[var(--color-info-soft)] text-[var(--color-info)]"
                  : "bg-[var(--color-success-soft)] text-[var(--color-success)]";

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-full ${badge}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-medium">{tx.description || "Sem descricao"}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge}`}
                        >
                          {tx.type === TransactionType.EXPENSE
                            ? "Despesa"
                            : tx.type === TransactionType.TRANSFER
                            ? "Transferencia"
                            : "Receita"}
                        </span>
                        <span>{formatDate(tx.occurredAt)}</span>
                      </div>
                    </div>
                  </div>
                  <span className={cn("text-sm font-semibold", color)}>{formatBRL(tx.amountCents)}</span>
                </div>
              );
            })}

            <div>
              <Button asChild variant="outline">
                <Link href={`/wallets/${walletId}/transactions`}>Ver todas as transacoes</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
