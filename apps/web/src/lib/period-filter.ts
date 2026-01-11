import { useCallback, useEffect, useMemo, useState } from "react";

export type PeriodFilter = {
  month: string;
  from: string | null;
  to: string | null;
};

export type ResolvedPeriod = {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  label: string;
  isRange: boolean;
};

const STORAGE_PREFIX = "gf.period.";
const monthRegex = /^\d{4}-\d{2}$/;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function getMonthValue(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function normalizeFilter(raw: Partial<PeriodFilter> | null | undefined): PeriodFilter {
  const fallbackMonth = getMonthValue();
  const month = raw?.month && monthRegex.test(raw.month) ? raw.month : fallbackMonth;
  const from = typeof raw?.from === "string" && raw.from ? raw.from : null;
  const to = typeof raw?.to === "string" && raw.to ? raw.to : null;
  return { month, from, to };
}

function storageKey(walletId: string) {
  return `${STORAGE_PREFIX}${walletId}`;
}

function loadStoredFilter(walletId: string) {
  if (typeof window === "undefined") {
    return normalizeFilter(null);
  }
  const raw = window.localStorage.getItem(storageKey(walletId));
  if (!raw) {
    return normalizeFilter(null);
  }
  try {
    return normalizeFilter(JSON.parse(raw) as Partial<PeriodFilter>);
  } catch {
    return normalizeFilter(null);
  }
}

function persistFilter(walletId: string, filter: PeriodFilter) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey(walletId), JSON.stringify(filter));
}

function parseMonth(value: string) {
  if (!monthRegex.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return null;
  return { year, month };
}

function parseInputDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatMonthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });
}

function formatRangeLabel(start: Date, end: Date) {
  const from = start.toLocaleDateString("pt-BR");
  const to = end.toLocaleDateString("pt-BR");
  return `${from} - ${to}`;
}

export function resolvePeriod(filter: PeriodFilter): ResolvedPeriod {
  const fallbackMonth = getMonthValue();
  const monthValue = monthRegex.test(filter.month) ? filter.month : fallbackMonth;
  const parsedMonth = parseMonth(monthValue);
  const now = new Date();
  const year = parsedMonth?.year ?? now.getFullYear();
  const month = parsedMonth?.month ?? now.getMonth() + 1;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  let start = monthStart;
  let end = monthEnd;
  let label = formatMonthLabel(year, month);
  let isRange = false;

  if (filter.from && filter.to) {
    const fromDate = parseInputDate(filter.from);
    const toDate = parseInputDate(filter.to);
    if (fromDate && toDate && fromDate <= toDate) {
      start = startOfDay(fromDate);
      end = addDays(startOfDay(toDate), 1);
      label = formatRangeLabel(fromDate, toDate);
      isRange = true;
    }
  }

  let prevStart: Date;
  let prevEnd: Date;
  if (isRange) {
    const duration = end.getTime() - start.getTime();
    prevEnd = start;
    prevStart = new Date(start.getTime() - duration);
  } else {
    prevEnd = start;
    prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  }

  return { start, end, prevStart, prevEnd, label, isRange };
}

export function usePeriodFilter(walletId?: string) {
  const [filter, setFilter] = useState<PeriodFilter>(() =>
    walletId ? loadStoredFilter(walletId) : normalizeFilter(null)
  );

  useEffect(() => {
    if (!walletId) {
      setFilter(normalizeFilter(null));
      return;
    }
    setFilter(loadStoredFilter(walletId));
  }, [walletId]);

  useEffect(() => {
    if (!walletId) {
      return;
    }
    persistFilter(walletId, filter);
  }, [walletId, filter]);

  const period = useMemo(() => resolvePeriod(filter), [filter]);

  const clearRange = useCallback(() => {
    setFilter((prev) => ({ ...prev, from: null, to: null }));
  }, []);

  return { filter, setFilter, period, clearRange };
}
