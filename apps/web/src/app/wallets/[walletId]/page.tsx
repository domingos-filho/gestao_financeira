"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { isRecurringExpenseActiveForMonth, shiftMonthKey, toMonthKey, TransactionType } from "@gf/shared";
import { ArrowDownRight, ArrowUpRight, List, Plus, Repeat, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { db, safeDexie } from "@/lib/db";
import { formatDate, parseDate } from "@/lib/date";
import { useWallets } from "@/lib/wallets";
import { usePeriodFilter } from "@/lib/period-filter";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuickTransactionForm } from "@/components/quick-transaction-form";
import { PeriodFilterPanel } from "@/components/period-filter";

function formatBRL(amountCents: number) {
  return (amountCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatProjectionMonth(monthKey: string | null) {
  if (!monthKey) {
    return "proximo mes";
  }
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) {
    return "proximo mes";
  }
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });
}

function getOccurredTime(value?: string | Date | null) {
  if (!value) {
    return 0;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export default function WalletDashboard({ params }: { params: { walletId: string } }) {
  const { walletId } = params;
  const walletsQuery = useWallets();
  const { filter, setFilter, period, clearRange } = usePeriodFilter(walletId);

  const transactions = useLiveQuery(
    () =>
      safeDexie(
        () => db.transactions_local.where("walletId").equals(walletId).and((tx) => !tx.deletedAt).toArray(),
        []
      ),
    [walletId]
  );
  const recurringExpenses = useLiveQuery(
    () => safeDexie(() => db.recurring_expenses_local.where("walletId").equals(walletId).toArray(), []),
    [walletId]
  );

  type Summary = {
    income: number;
    expense: number;
    net: number;
    recent: NonNullable<typeof transactions>;
  };

  const periodSummary = useMemo<Summary>(() => {
    if (!transactions) {
      return { income: 0, expense: 0, net: 0, recent: [] };
    }

    let income = 0;
    let expense = 0;
    const filtered = transactions.filter((tx) => {
      const occurred = parseDate(tx.occurredAt);
      return occurred ? occurred >= period.start && occurred < period.end : false;
    });

    for (const tx of filtered) {
      if (tx.type === TransactionType.INCOME) income += tx.amountCents;
      if (tx.type === TransactionType.EXPENSE) expense += tx.amountCents;
    }

    const recent = [...filtered]
      .sort((a, b) => getOccurredTime(b.occurredAt) - getOccurredTime(a.occurredAt))
      .slice(0, 5);

    return {
      income,
      expense,
      net: income - expense,
      recent
    };
  }, [period.end, period.start, transactions]);

  const previousSummary = useMemo(() => {
    if (!transactions) {
      return { income: 0, expense: 0 };
    }
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      const occurred = parseDate(tx.occurredAt);
      if (occurred && occurred >= period.prevStart && occurred < period.prevEnd) {
        if (tx.type === TransactionType.INCOME) income += tx.amountCents;
        if (tx.type === TransactionType.EXPENSE) expense += tx.amountCents;
      }
    }
    return { income, expense };
  }, [period.prevEnd, period.prevStart, transactions]);

  const comparisonLabel = period.isRange ? "em relacao ao periodo anterior" : "em relacao ao mes passado";
  const incomeDelta =
    previousSummary.income > 0
      ? ((periodSummary.income - previousSummary.income) / previousSummary.income) * 100
      : null;
  const expenseDelta =
    previousSummary.expense > 0
      ? ((periodSummary.expense - previousSummary.expense) / previousSummary.expense) * 100
      : null;

  const budgetTarget = periodSummary.income;
  const budgetUsed = periodSummary.expense;
  const budgetPct = budgetTarget ? Math.min(100, Math.round((budgetUsed / budgetTarget) * 100)) : 0;
  const nextMonthBudget = useMemo(() => {
    const baseMonth = toMonthKey(period.start.toISOString());
    const projectedMonth = baseMonth ? shiftMonthKey(baseMonth, 1) : null;
    if (!projectedMonth) {
      return {
        monthKey: null,
        monthLabel: "proximo mes",
        recurringExpense: 0,
        incomeReference: 0,
        projectedNet: 0,
        recurringCount: 0,
        committedPct: null as number | null,
        topRecurring: [] as { id: string; description: string; amountCents: number; dayOfMonth: number }[]
      };
    }

    const samples = [-1, -2, -3]
      .map((offset) => shiftMonthKey(projectedMonth, offset))
      .filter((value): value is string => Boolean(value));

    const incomeSeries = samples.map((monthKey) => {
      let income = 0;
      for (const tx of transactions ?? []) {
        if (toMonthKey(tx.occurredAt) !== monthKey) {
          continue;
        }
        if (tx.type === TransactionType.INCOME) {
          income += tx.amountCents;
        }
      }
      return income;
    });

    const hasIncomeHistory = incomeSeries.some((value) => value > 0);
    const incomeReference = hasIncomeHistory
      ? Math.round(incomeSeries.reduce((sum, value) => sum + value, 0) / incomeSeries.length)
      : periodSummary.income;

    const activeRecurring = (recurringExpenses ?? [])
      .filter((entry) =>
        isRecurringExpenseActiveForMonth({
          startMonth: entry.startMonth,
          archivedAt: entry.archivedAt ?? null,
          monthKey: projectedMonth
        })
      )
      .sort((left, right) => right.amountCents - left.amountCents);

    const recurringExpense = activeRecurring.reduce((sum, entry) => sum + entry.amountCents, 0);
    const committedPct =
      incomeReference > 0 ? Math.min(100, Math.round((recurringExpense / incomeReference) * 100)) : null;

    return {
      monthKey: projectedMonth,
      monthLabel: formatProjectionMonth(projectedMonth),
      recurringExpense,
      incomeReference,
      projectedNet: incomeReference - recurringExpense,
      recurringCount: activeRecurring.length,
      committedPct,
      topRecurring: activeRecurring.slice(0, 3).map((entry) => ({
        id: entry.id,
        description: entry.description,
        amountCents: entry.amountCents,
        dayOfMonth: entry.dayOfMonth
      }))
    };
  }, [period.start, periodSummary.income, recurringExpenses, transactions]);
  const walletName = useMemo(() => {
    const entry = walletsQuery.data?.find((item) => item.wallet.id === walletId);
    return entry?.wallet.name ?? null;
  }, [walletId, walletsQuery.data]);

  return (
    <div className="grid gap-6 animate-rise">
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            {walletName && (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                Carteira: {walletName}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Visao geral das suas financas pessoais</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilterPanel
            filter={filter}
            onFilterChange={setFilter}
            periodLabel={period.label}
            isRangeActive={period.isRange}
            onClearRange={clearRange}
            className="w-full"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Receitas</span>
              <TrendingUp className="h-4 w-4 text-[var(--color-success)]" />
            </div>
            <CardTitle className="text-xl text-[var(--color-success)]">{formatBRL(periodSummary.income)}</CardTitle>
            <CardDescription
              className={
                incomeDelta === null
                  ? "text-muted-foreground"
                  : incomeDelta >= 0
                  ? "text-[var(--color-success)]"
                  : "text-[var(--color-danger)]"
              }
            >
              {incomeDelta === null ? "Sem comparacao" : `${incomeDelta.toFixed(1)}% ${comparisonLabel}`}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Despesas</span>
              <TrendingDown className="h-4 w-4 text-[var(--color-danger)]" />
            </div>
            <CardTitle className="text-xl text-[var(--color-danger)]">{formatBRL(periodSummary.expense)}</CardTitle>
            <CardDescription
              className={
                expenseDelta === null
                  ? "text-muted-foreground"
                  : expenseDelta <= 0
                  ? "text-[var(--color-success)]"
                  : "text-[var(--color-danger)]"
              }
            >
              {expenseDelta === null ? "Sem comparacao" : `${expenseDelta.toFixed(1)}% ${comparisonLabel}`}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Saldo</span>
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-xl">{formatBRL(periodSummary.net)}</CardTitle>
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
            <CardDescription>{formatBRL(budgetTarget)} recebido no periodo</CardDescription>
            <div className="h-2 w-full rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${budgetPct}%` }} />
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Proximo mes</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {nextMonthBudget.recurringCount} fixos
              </span>
            </div>
            <CardTitle className="text-xl">{formatBRL(nextMonthBudget.recurringExpense)}</CardTitle>
            <CardDescription>
              {nextMonthBudget.monthLabel} · saldo estimado {formatBRL(nextMonthBudget.projectedNet)}
            </CardDescription>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-[var(--color-info)]"
                style={{ width: `${nextMonthBudget.committedPct ?? 0}%` }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {nextMonthBudget.topRecurring.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem gastos recorrentes ativos.</p>
            ) : (
              nextMonthBudget.topRecurring.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{entry.description}</p>
                    <p className="text-muted-foreground">Dia {entry.dayOfMonth}</p>
                  </div>
                  <span className="whitespace-nowrap font-semibold text-[var(--color-info)]">
                    {formatBRL(entry.amountCents)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
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
            <CardDescription>Ultimos registros do periodo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {periodSummary.recent.length === 0 && <p className="text-sm text-muted-foreground">Sem transacoes.</p>}
            {periodSummary.recent.map((tx) => {
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
                        {tx.recurringExpenseId && (
                          <span className="rounded-full border border-[rgba(79,162,255,0.25)] bg-[var(--color-info-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-info)]">
                            Recorrente
                          </span>
                        )}
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
