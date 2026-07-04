import { TransactionType } from "@gf/shared";

export type ReportPeriod = "day" | "week" | "month" | "year";

export type ReportBucket = {
  label: string;
  start: Date;
  end: Date;
};

export type ReportTransaction = {
  type: TransactionType;
  amountCents: number;
  occurredAt: string;
  categoryId?: string | null;
};

type ReportRange = {
  start: Date;
  end: Date;
};

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

function summarizeTransactionTotals(transactions: ReportTransaction[]) {
  let income = 0;
  let expense = 0;

  for (const transaction of transactions) {
    if (transaction.type === TransactionType.INCOME) {
      income += transaction.amountCents;
    }
    if (transaction.type === TransactionType.EXPENSE) {
      expense += transaction.amountCents;
    }
  }

  return {
    income,
    expense,
    net: income - expense
  };
}

export function buildReportBuckets(period: ReportPeriod, referenceDate = new Date()) {
  if (period === "day") {
    const start = startOfDay(referenceDate);
    return Array.from({ length: 14 }).map((_, index) => {
      const date = addDays(start, index - 13);
      return {
        label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        start: date,
        end: addDays(date, 1)
      } satisfies ReportBucket;
    });
  }

  if (period === "week") {
    const start = startOfWeek(referenceDate);
    return Array.from({ length: 12 }).map((_, index) => {
      const date = addDays(start, (index - 11) * 7);
      return {
        label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        start: date,
        end: addDays(date, 7)
      } satisfies ReportBucket;
    });
  }

  if (period === "year") {
    return Array.from({ length: 5 }).map((_, index) => {
      const year = referenceDate.getFullYear() - (4 - index);
      const start = new Date(year, 0, 1);
      const end = new Date(year + 1, 0, 1);
      return { label: String(year), start, end } satisfies ReportBucket;
    });
  }

  return Array.from({ length: 12 }).map((_, index) => {
    const month = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (11 - index), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    return {
      label: month.toLocaleDateString("pt-BR", { month: "short" }).toUpperCase(),
      start: month,
      end
    } satisfies ReportBucket;
  });
}

export function getRangeFromBuckets(buckets: ReportBucket[]): ReportRange {
  const start = buckets[0]?.start ?? new Date();
  const end = buckets[buckets.length - 1]?.end ?? start;
  return { start, end };
}

export function getPreviousRange(range: ReportRange): ReportRange {
  const duration = range.end.getTime() - range.start.getTime();
  return {
    start: new Date(range.start.getTime() - duration),
    end: range.start
  };
}

export function filterTransactionsByRange(
  transactions: ReportTransaction[],
  range: ReportRange
) {
  return transactions.filter((transaction) => {
    const occurred = new Date(transaction.occurredAt);
    return occurred >= range.start && occurred < range.end;
  });
}

export function summarizeTransactions(
  transactions: ReportTransaction[],
  range?: ReportRange
) {
  const filtered = range ? filterTransactionsByRange(transactions, range) : transactions;
  return summarizeTransactionTotals(filtered);
}

export function calculatePercentChange(current: number, previous: number) {
  if (previous === 0) {
    return null;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}
