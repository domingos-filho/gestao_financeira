"use client";

import { useCallback, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { TransactionType } from "@gf/shared";
import { db, safeDexie } from "@/lib/db";
import {
  buildReportBuckets,
  calculatePercentChange,
  filterTransactionsByRange,
  getPreviousRange,
  getRangeFromBuckets,
  summarizeTransactions,
  type ReportPeriod
} from "@/lib/report-metrics";
import {
  BarPairChart,
  Gauge,
  LineChart,
  MultiLineChart,
  TreemapChart,
  WaterfallChart
} from "@/components/report-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";

function formatBRL(amountCents: number) {
  return (amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function sumBalanceBefore(
  transactions: Array<{ type: TransactionType; amountCents: number; occurredAt: string }>,
  start: Date
) {
  let balance = 0;
  for (const transaction of transactions) {
    const occurred = new Date(transaction.occurredAt);
    if (occurred >= start) {
      continue;
    }
    if (transaction.type === TransactionType.INCOME) {
      balance += transaction.amountCents;
    }
    if (transaction.type === TransactionType.EXPENSE) {
      balance -= transaction.amountCents;
    }
  }
  return balance;
}

function formatProjectionLabels(length: number) {
  const now = new Date();
  return Array.from({ length }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index, 1);
    return date.toLocaleDateString("pt-BR", { month: "short" }).toUpperCase();
  });
}

export default function ReportsPage({ params }: { params: { walletId: string } }) {
  const { walletId } = params;
  const [period, setPeriod] = useState<ReportPeriod>("month");

  const transactions = useLiveQuery(
    () =>
      safeDexie(
        () =>
          db.transactions_local
            .where("walletId")
            .equals(walletId)
            .and((tx) => !tx.deletedAt)
            .toArray(),
        []
      ),
    [walletId]
  );
  const categories = useLiveQuery(
    () => safeDexie(() => db.categories_local.where("walletId").equals(walletId).toArray(), []),
    [walletId]
  );
  const debts = useLiveQuery(
    () => safeDexie(() => db.debts_local.where("walletId").equals(walletId).toArray(), []),
    [walletId]
  );

  const buckets = useMemo(() => buildReportBuckets(period), [period]);
  const currentRange = useMemo(() => getRangeFromBuckets(buckets), [buckets]);
  const previousRange = useMemo(() => getPreviousRange(currentRange), [currentRange]);
  const currentTransactions = useMemo(
    () => filterTransactionsByRange(transactions ?? [], currentRange),
    [transactions, currentRange]
  );
  const previousTransactions = useMemo(
    () => filterTransactionsByRange(transactions ?? [], previousRange),
    [transactions, previousRange]
  );
  const currentTotals = useMemo(() => summarizeTransactions(currentTransactions), [currentTransactions]);
  const previousTotals = useMemo(() => summarizeTransactions(previousTransactions), [previousTransactions]);

  const cashFlow = useMemo(() => {
    const series = buckets.map((bucket) => summarizeTransactions(transactions ?? [], bucket));
    const totalIncome = currentTotals.income;
    const totalExpense = currentTotals.expense;
    const previousNet = previousTotals.net;
    const variation = calculatePercentChange(currentTotals.net, previousNet);
    const initialBalance = sumBalanceBefore(transactions ?? [], currentRange.start);
    const finalBalance = initialBalance + currentTotals.net;

    return {
      series,
      totalIncome,
      totalExpense,
      initialBalance,
      finalBalance,
      variation
    };
  }, [buckets, currentRange.start, currentTotals, previousTotals, transactions]);

  const categoryMap = useMemo(
    () => new Map((categories ?? []).map((category) => [category.id, category.name])),
    [categories]
  );

  const categoryLabel = useCallback((key: string) => {
    if (key === "uncategorized") return "Sem categoria";
    return categoryMap.get(key) ?? "Categoria";
  }, [categoryMap]);

  const categoryInsights = useMemo(() => {
    const list = currentTransactions;
    const sums = new Map<string, { income: number; expense: number }>();
    for (const tx of list) {
      const key = tx.categoryId ?? "uncategorized";
      const current = sums.get(key) ?? { income: 0, expense: 0 };
      if (tx.type === TransactionType.INCOME) current.income += tx.amountCents;
      if (tx.type === TransactionType.EXPENSE) current.expense += tx.amountCents;
      sums.set(key, current);
    }

    const expenseRows = Array.from(sums.entries())
      .map(([key, value]) => ({ key, total: value.expense }))
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const incomeRows = Array.from(sums.entries())
      .map(([key, value]) => ({ key, total: value.income }))
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const buildTrend = (key: string, type: TransactionType) =>
      buckets.map((bucket) => {
        let total = 0;
        for (const tx of list) {
          const occurred = new Date(tx.occurredAt);
          if (
            occurred >= bucket.start &&
            occurred < bucket.end &&
            (tx.categoryId ?? "uncategorized") === key &&
            tx.type === type
          ) {
            total += tx.amountCents;
          }
        }
        return total;
      });

    const topExpenseSeries = expenseRows.slice(0, 3).map((entry, index) => ({
      label: categoryLabel(entry.key),
      values: buildTrend(entry.key, TransactionType.EXPENSE),
      className:
        ["var(--color-success-strong)", "var(--color-info)", "var(--color-purple)"][index] ??
        "var(--color-success-strong)"
    }));

    return { expenseRows, incomeRows, topExpenseSeries };
  }, [buckets, categoryLabel, currentTransactions]);

  const debtInsights = useMemo(() => {
    const list = debts ?? [];
    const active = list.filter((debt) => debt.status === "ACTIVE");
    const totalDebt = active.reduce((sum, debt) => sum + debt.principalCents, 0);
    const periodIncome = currentTotals.income;
    const ratio = periodIncome > 0 ? totalDebt / periodIncome : null;

    const amortizations = active.map((debt) => {
      const principal = debt.principalCents / 100;
      const payment = (debt.monthlyPaymentCents ?? 0) / 100;
      const rate = (debt.interestRate ?? 0) / 100 / 12;
      if (!payment || payment <= 0) {
        return { id: debt.id, months: null, totalInterest: 0 };
      }
      if (rate === 0) {
        const months = Math.ceil(principal / payment);
        return { id: debt.id, months, totalInterest: 0 };
      }
      if (payment <= principal * rate) {
        return { id: debt.id, months: null, totalInterest: 0 };
      }
      const months = Math.ceil(-Math.log(1 - (rate * principal) / payment) / Math.log(1 + rate));
      const totalInterest = payment * months - principal;
      return { id: debt.id, months, totalInterest: Math.max(0, totalInterest) };
    });

    const totalInterest = amortizations.reduce((sum, item) => sum + item.totalInterest, 0);

    const series = Array.from({ length: 12 }).map((_, index) => {
      let remaining = 0;
      for (const debt of active) {
        const principal = debt.principalCents / 100;
        const payment = (debt.monthlyPaymentCents ?? 0) / 100;
        const rate = (debt.interestRate ?? 0) / 100 / 12;
        if (!payment || payment <= 0) {
          remaining += principal;
          continue;
        }
        if (rate === 0) {
          remaining += Math.max(0, principal - payment * index);
          continue;
        }
        const balance =
          principal * Math.pow(1 + rate, index) - (payment * (Math.pow(1 + rate, index) - 1)) / rate;
        remaining += Math.max(0, balance);
      }
      return remaining * 100;
    });

    return {
      totalDebt,
      periodIncome,
      ratio,
      totalInterest: Math.round(totalInterest * 100),
      series,
      labels: formatProjectionLabels(series.length),
      amortizations
    };
  }, [currentTotals.income, debts]);

  const profitInsights = useMemo(() => {
    const series = buckets.map((bucket) => summarizeTransactions(currentTransactions, bucket));
    const current = currentTotals;
    const averageNet =
      series.length > 0 ? series.reduce((sum, item) => sum + item.net, 0) / series.length : 0;
    const margin = current.income > 0 ? (current.net / current.income) * 100 : 0;
    const comparison = calculatePercentChange(current.net, previousTotals.net);
    return { series, current, averageNet, margin, comparison };
  }, [buckets, currentTotals, currentTransactions, previousTotals.net]);

  const healthScore = useMemo(() => {
    const income = profitInsights.current.income;
    const net = profitInsights.current.net;
    const savingsRate = income > 0 ? net / income : 0;
    const savingsScore = Math.min(1, Math.max(0, savingsRate / 0.3)) * 40;
    const debtScore =
      debtInsights.periodIncome > 0 && debtInsights.ratio !== null
        ? Math.max(0, 1 - debtInsights.ratio) * 30
        : 15;
    const liquidityScore = net >= 0 ? 30 : 10;
    const total = Math.round(savingsScore + debtScore + liquidityScore);
    return Math.max(0, Math.min(100, total));
  }, [debtInsights.periodIncome, debtInsights.ratio, profitInsights]);

  const categoryPalette = [
    "var(--color-success-strong)",
    "var(--color-info)",
    "var(--color-purple)",
    "var(--color-warning)",
    "var(--color-danger-strong)"
  ];
  const categoryTreemap = categoryInsights.expenseRows.map((entry, index) => ({
    label: categoryLabel(entry.key),
    value: entry.total,
    className: categoryPalette[index] ?? "var(--color-success-strong)"
  }));

  return (
    <div className="grid gap-4 sm:gap-6 animate-rise">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Relatorios Financeiros</h1>
          <p className="text-sm text-muted-foreground">Analise detalhada das suas financas</p>
        </div>
        <div className="relative w-full sm:w-48">
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
            className="h-10 w-full appearance-none rounded-lg border border-border bg-card px-3 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Selecionar periodo"
          >
            <option value="day">Ultimos 14 dias</option>
            <option value="week">Ultimas 12 semanas</option>
            <option value="month">Ultimos 12 meses</option>
            <option value="year">Ultimos 5 anos</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-5">
          <CardTitle>Fluxo de Caixa</CardTitle>
          <CardDescription>Entradas, saidas e saldo liquido do periodo selecionado</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 pt-0 sm:p-5 sm:pt-0 lg:grid-cols-3 lg:gap-6">
          <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-1">
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="text-muted-foreground">Receitas</div>
              <div className="mt-1 text-lg font-semibold text-[var(--color-success)] sm:text-xl">
                {formatBRL(cashFlow.totalIncome)}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="text-muted-foreground">Despesas</div>
              <div className="mt-1 text-lg font-semibold text-[var(--color-danger)] sm:text-xl">
                {formatBRL(cashFlow.totalExpense)}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="text-muted-foreground">Saldo liquido</div>
              <div className="mt-1 text-lg font-semibold sm:text-xl">{formatBRL(currentTotals.net)}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="text-muted-foreground">Variacao vs periodo anterior</div>
              <div className="mt-1 text-lg font-semibold">
              {cashFlow.variation === null ? "Sem comparacao" : `${cashFlow.variation.toFixed(1)}%`}
              </div>
            </div>
          </div>
          <div className="space-y-4 lg:col-span-2">
            <WaterfallChart
              steps={[
                { label: "Saldo inicial", value: cashFlow.initialBalance, kind: "base" },
                { label: "Receitas", value: cashFlow.totalIncome, kind: "delta" },
                { label: "Despesas", value: -cashFlow.totalExpense, kind: "delta" },
                { label: "Saldo final", value: cashFlow.finalBalance, kind: "total" }
              ]}
              formatValue={formatBRL}
            />
            <div className="text-xs text-muted-foreground">Linha de tendencia do saldo liquido</div>
            <LineChart
              values={cashFlow.series.map((item) => item.net)}
              labels={buckets.map((bucket) => bucket.label)}
              color="var(--color-success)"
              formatValue={formatBRL}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-5">
          <CardTitle>Analise de Categorias</CardTitle>
          <CardDescription>Top categorias e participacao no periodo</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 pt-0 sm:p-5 sm:pt-0 lg:grid-cols-3 lg:gap-6">
          <div className="flex items-center justify-center lg:justify-start">
            <TreemapChart items={categoryTreemap} formatValue={formatBRL} />
          </div>
          <div className="space-y-4 lg:col-span-2">
            <div>
              <h3 className="text-sm font-semibold">Top 5 despesas</h3>
              <div className="mt-2 space-y-2">
                {categoryInsights.expenseRows.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem despesas com categoria.</p>
                )}
                {categoryInsights.expenseRows.map((entry) => (
                  <div key={entry.key} className="flex items-center justify-between text-sm">
                    <span>{categoryLabel(entry.key)}</span>
                    <span className="font-semibold">{formatBRL(entry.total)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Top 5 receitas</h3>
              <div className="mt-2 space-y-2">
                {categoryInsights.incomeRows.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem receitas com categoria.</p>
                )}
                {categoryInsights.incomeRows.map((entry) => (
                  <div key={entry.key} className="flex items-center justify-between text-sm">
                    <span>{categoryLabel(entry.key)}</span>
                    <span className="font-semibold">{formatBRL(entry.total)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Evolucao por categoria</h3>
              <MultiLineChart
                series={categoryInsights.topExpenseSeries}
                labels={buckets.map((bucket) => bucket.label)}
                formatValue={formatBRL}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-5">
          <CardTitle>Analise de Dividas</CardTitle>
          <CardDescription>Evolucao e relacao com a renda do periodo</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 pt-0 sm:p-5 sm:pt-0 lg:grid-cols-3 lg:gap-6">
          <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-1">
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="text-muted-foreground">Total de dividas</div>
              <div className="mt-1 text-lg font-semibold sm:text-xl">{formatBRL(debtInsights.totalDebt)}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="text-muted-foreground">Juros estimados</div>
              <div className="mt-1 text-lg font-semibold sm:text-xl">{formatBRL(debtInsights.totalInterest)}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="text-muted-foreground">Divida / renda</div>
              <div className="mt-1 text-lg font-semibold">
              {debtInsights.ratio === null ? "Sem renda" : `${(debtInsights.ratio * 100).toFixed(1)}%`}
              </div>
            </div>
          </div>
          <div className="space-y-3 lg:col-span-2">
            <LineChart
              values={debtInsights.series}
              labels={debtInsights.labels}
              color="var(--color-warning)"
              formatValue={formatBRL}
            />
            <p className="text-xs text-muted-foreground">Projecao de quitacao (12 meses)</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-5">
          <CardTitle>Resultado do Periodo</CardTitle>
          <CardDescription>Comparativo com o periodo anterior equivalente</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 pt-0 sm:p-5 sm:pt-0 lg:grid-cols-3 lg:gap-6">
          <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-1">
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="text-muted-foreground">Lucro liquido</div>
              <div className="mt-1 text-lg font-semibold sm:text-xl">{formatBRL(profitInsights.current.net)}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="text-muted-foreground">Margem de lucro</div>
              <div className="mt-1 text-lg font-semibold sm:text-xl">{profitInsights.margin.toFixed(1)}%</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="text-muted-foreground">Media no periodo</div>
              <div className="mt-1 text-lg font-semibold sm:text-xl">{formatBRL(Math.round(profitInsights.averageNet))}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="text-muted-foreground">Variacao vs periodo anterior</div>
              <div className="mt-1 text-lg font-semibold">
              {profitInsights.comparison === null ? "Sem comparacao" : `${profitInsights.comparison.toFixed(1)}%`}
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <BarPairChart
              income={profitInsights.series.map((item) => item.income)}
              expense={profitInsights.series.map((item) => item.expense)}
              labels={buckets.map((bucket) => bucket.label)}
              formatValue={formatBRL}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-5">
          <CardTitle>Saude Financeira</CardTitle>
          <CardDescription>Indice consolidado de equilibrio</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4 p-4 pt-0 sm:p-5 sm:pt-0 md:flex-row md:items-center md:justify-between">
          <Gauge value={healthScore} />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Indice de poupanca:{" "}
              {profitInsights.current.income > 0
                ? ((profitInsights.current.net / profitInsights.current.income) * 100).toFixed(1)
                : "0"}
              %
            </p>
            <p>
              Indice de endividamento:{" "}
              {debtInsights.ratio === null ? "0%" : `${(debtInsights.ratio * 100).toFixed(1)}%`}
            </p>
            <p>Nivel de liquidez: {profitInsights.current.net >= 0 ? "Positivo" : "Negativo"}</p>
            <p>
              Cumprimento de metas:{" "}
              {healthScore >= 70 ? "Acima do esperado" : healthScore >= 40 ? "Estavel" : "Baixo"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
