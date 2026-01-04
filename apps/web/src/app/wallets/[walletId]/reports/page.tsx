"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { TransactionType } from "@gf/shared";
import { db, safeDexie } from "@/lib/db";
import { BarPairChart, Gauge, LineChart, MultiLineChart, PieChart } from "@/components/report-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Period = "day" | "week" | "month" | "year";

type Bucket = {
  label: string;
  start: Date;
  end: Date;
};

function formatBRL(amountCents: number) {
  return (amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(startOfDay(date), diff);
}

function buildBuckets(period: Period): Bucket[] {
  const now = new Date();
  if (period === "day") {
    const start = startOfDay(now);
    return Array.from({ length: 14 }).map((_, index) => {
      const date = addDays(start, index - 13);
      return {
        label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        start: date,
        end: addDays(date, 1)
      };
    });
  }

  if (period === "week") {
    const start = startOfWeek(now);
    return Array.from({ length: 12 }).map((_, index) => {
      const date = addDays(start, (index - 11) * 7);
      return {
        label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        start: date,
        end: addDays(date, 7)
      };
    });
  }

  if (period === "year") {
    return Array.from({ length: 5 }).map((_, index) => {
      const year = now.getFullYear() - (4 - index);
      const start = new Date(year, 0, 1);
      const end = new Date(year + 1, 0, 1);
      return { label: String(year), start, end };
    });
  }

  return Array.from({ length: 12 }).map((_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    return {
      label: month.toLocaleDateString("pt-BR", { month: "short" }).toUpperCase(),
      start: month,
      end
    };
  });
}

function buildMonthBuckets(count: number) {
  const now = new Date();
  return Array.from({ length: count }).map((_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    return {
      label: month.toLocaleDateString("pt-BR", { month: "short" }).toUpperCase(),
      start: month,
      end
    };
  });
}

export default function ReportsPage({ params }: { params: { walletId: string } }) {
  const { walletId } = params;
  const [period, setPeriod] = useState<Period>("month");

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

  const buckets = useMemo(() => buildBuckets(period), [period]);

  const cashFlow = useMemo(() => {
    const list = transactions ?? [];
    const series = buckets.map((bucket) => {
      let income = 0;
      let expense = 0;
      for (const tx of list) {
        const occurred = new Date(tx.occurredAt);
        if (occurred >= bucket.start && occurred < bucket.end) {
          if (tx.type === TransactionType.INCOME) income += tx.amountCents;
          if (tx.type === TransactionType.EXPENSE) expense += tx.amountCents;
        }
      }
      return { income, expense, net: income - expense };
    });

    const totalIncome = series.reduce((sum, item) => sum + item.income, 0);
    const totalExpense = series.reduce((sum, item) => sum + item.expense, 0);
    const rangeStart = buckets[0]?.start;
    let initialBalance = 0;

    if (rangeStart) {
      for (const tx of list) {
        const occurred = new Date(tx.occurredAt);
        if (occurred < rangeStart) {
          if (tx.type === TransactionType.INCOME) initialBalance += tx.amountCents;
          if (tx.type === TransactionType.EXPENSE) initialBalance -= tx.amountCents;
        }
      }
    }

    const finalBalance = initialBalance + totalIncome - totalExpense;
    const variation =
      initialBalance !== 0 ? ((finalBalance - initialBalance) / Math.abs(initialBalance)) * 100 : null;

    return {
      series,
      totalIncome,
      totalExpense,
      initialBalance,
      finalBalance,
      variation
    };
  }, [transactions, buckets]);

  const categoryMap = useMemo(
    () => new Map((categories ?? []).map((category) => [category.id, category.name])),
    [categories]
  );

  const categoryInsights = useMemo(() => {
    const list = transactions ?? [];
    const range = buildMonthBuckets(6);
    const rangeStart = range[0]?.start ?? new Date(0);
    const rangeEnd = range[range.length - 1]?.end ?? new Date();

    const sums = new Map<string, { income: number; expense: number }>();
    for (const tx of list) {
      const occurred = new Date(tx.occurredAt);
      if (occurred < rangeStart || occurred >= rangeEnd) continue;
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
      range.map((bucket) => {
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
      label: entry.key,
      values: buildTrend(entry.key, TransactionType.EXPENSE),
      className: ["text-emerald-500", "text-blue-500", "text-purple-500"][index] ?? "text-emerald-500"
    }));

    return { range, expenseRows, incomeRows, topExpenseSeries };
  }, [transactions, categoryMap]);

  const debtInsights = useMemo(() => {
    const list = debts ?? [];
    const active = list.filter((debt) => debt.status === "ACTIVE");
    const totalDebt = active.reduce((sum, debt) => sum + debt.principalCents, 0);

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
    let monthIncome = 0;
    for (const tx of transactions ?? []) {
      const occurred = new Date(tx.occurredAt);
      if (occurred >= monthStart && occurred < monthEnd && tx.type === TransactionType.INCOME) {
        monthIncome += tx.amountCents;
      }
    }

    const ratio = monthIncome > 0 ? totalDebt / monthIncome : null;

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
      monthIncome,
      ratio,
      totalInterest: Math.round(totalInterest * 100),
      series,
      amortizations
    };
  }, [debts, transactions]);

  const profitInsights = useMemo(() => {
    const list = transactions ?? [];
    const range = buildMonthBuckets(6);
    const series = range.map((bucket) => {
      let income = 0;
      let expense = 0;
      for (const tx of list) {
        const occurred = new Date(tx.occurredAt);
        if (occurred >= bucket.start && occurred < bucket.end) {
          if (tx.type === TransactionType.INCOME) income += tx.amountCents;
          if (tx.type === TransactionType.EXPENSE) expense += tx.amountCents;
        }
      }
      return { income, expense, net: income - expense };
    });
    const current = series[series.length - 1] ?? { income: 0, expense: 0, net: 0 };
    const averageNet =
      series.length > 0 ? series.reduce((sum, item) => sum + item.net, 0) / series.length : 0;
    const margin = current.income > 0 ? (current.net / current.income) * 100 : 0;
    return { range, series, current, averageNet, margin };
  }, [transactions]);

  const healthScore = useMemo(() => {
    const income = profitInsights.current.income;
    const net = profitInsights.current.net;
    const savingsRate = income > 0 ? net / income : 0;
    const savingsScore = Math.min(1, Math.max(0, savingsRate / 0.3)) * 40;
    const debtScore =
      debtInsights.monthIncome > 0 && debtInsights.ratio !== null
        ? Math.max(0, 1 - debtInsights.ratio) * 30
        : 15;
    const liquidityScore = net >= 0 ? 30 : 10;
    const total = Math.round(savingsScore + debtScore + liquidityScore);
    return Math.max(0, Math.min(100, total));
  }, [profitInsights, debtInsights]);

  const categoryPalette = ["text-emerald-500", "text-blue-500", "text-purple-500", "text-amber-500", "text-rose-500"];
  const categoryPie = categoryInsights.expenseRows.map((entry, index) => ({
    label: entry.key,
    value: entry.total,
    className: categoryPalette[index] ?? "text-emerald-500"
  }));

  const categoryLabel = (key: string) => {
    if (key === "uncategorized") return "Sem categoria";
    return categoryMap.get(key) ?? "Categoria";
  };

  return (
    <div className="grid gap-6 animate-rise">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Relatorios Financeiros</h1>
          <p className="text-sm text-muted-foreground">Analise detalhada das suas financas</p>
        </div>
        <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Ultimos 14 dias</SelectItem>
            <SelectItem value="week">Ultimas 12 semanas</SelectItem>
            <SelectItem value="month">Ultimos 12 meses</SelectItem>
            <SelectItem value="year">Ultimos 5 anos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fluxo de Caixa</CardTitle>
          <CardDescription>Entradas e saidas por periodo</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Saldo inicial</div>
            <div className="text-xl font-semibold">{formatBRL(cashFlow.initialBalance)}</div>
            <div className="text-sm text-muted-foreground">Saldo final</div>
            <div className="text-xl font-semibold">{formatBRL(cashFlow.finalBalance)}</div>
            <div className="text-sm text-muted-foreground">Variacao</div>
            <div className="text-sm font-semibold">
              {cashFlow.variation === null ? "Sem comparacao" : `${cashFlow.variation.toFixed(1)}%`}
            </div>
          </div>
          <div className="space-y-3 lg:col-span-2">
            <BarPairChart
              income={cashFlow.series.map((item) => item.income)}
              expense={cashFlow.series.map((item) => item.expense)}
            />
            <div className="text-xs text-muted-foreground">Linha de tendencia (saldo liquido)</div>
            <LineChart values={cashFlow.series.map((item) => item.net)} className="text-emerald-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analise de Categorias</CardTitle>
          <CardDescription>Top categorias e participacao no total</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div className="flex items-center justify-center">
            <PieChart slices={categoryPie} />
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
              <MultiLineChart series={categoryInsights.topExpenseSeries} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analise de Dividas</CardTitle>
          <CardDescription>Evolucao e relacao com renda</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Total de dividas</div>
            <div className="text-xl font-semibold">{formatBRL(debtInsights.totalDebt)}</div>
            <div className="text-sm text-muted-foreground">Juros estimados</div>
            <div className="text-xl font-semibold">{formatBRL(debtInsights.totalInterest)}</div>
            <div className="text-sm text-muted-foreground">Divida / renda</div>
            <div className="text-sm font-semibold">
              {debtInsights.ratio === null ? "Sem renda" : `${(debtInsights.ratio * 100).toFixed(1)}%`}
            </div>
          </div>
          <div className="space-y-3 lg:col-span-2">
            <LineChart values={debtInsights.series} className="text-amber-500" />
            <p className="text-xs text-muted-foreground">Projecao de quitacao (12 meses)</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultado Mensal</CardTitle>
          <CardDescription>Comparativo com a media recente</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Lucro liquido</div>
            <div className="text-xl font-semibold">{formatBRL(profitInsights.current.net)}</div>
            <div className="text-sm text-muted-foreground">Margem de lucro</div>
            <div className="text-xl font-semibold">{profitInsights.margin.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Media 6 meses</div>
            <div className="text-xl font-semibold">{formatBRL(Math.round(profitInsights.averageNet))}</div>
          </div>
          <div className="lg:col-span-2">
            <BarPairChart
              income={profitInsights.series.map((item) => item.income)}
              expense={profitInsights.series.map((item) => item.expense)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saude Financeira</CardTitle>
          <CardDescription>Indice consolidado de equilibrio</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <Gauge value={healthScore} />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Indice de poupanca: {profitInsights.current.income > 0 ? ((profitInsights.current.net / profitInsights.current.income) * 100).toFixed(1) : "0"}%</p>
            <p>Indice de endividamento: {debtInsights.ratio === null ? "0%" : `${(debtInsights.ratio * 100).toFixed(1)}%`}</p>
            <p>Nivel de liquidez: {profitInsights.current.net >= 0 ? "Positivo" : "Negativo"}</p>
            <p>Cumprimento de metas: {healthScore >= 70 ? "Acima do esperado" : healthScore >= 40 ? "Estavel" : "Baixo"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
