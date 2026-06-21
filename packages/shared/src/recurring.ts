import { toTimestamp } from "./datetime";

export const monthKeyRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

type MonthParts = {
  year: number;
  month: number;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function isMonthKey(value?: string | null): value is string {
  return typeof value === "string" && monthKeyRegex.test(value);
}

export function buildMonthKey(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return `${year}-${pad2(month)}`;
}

export function parseMonthKey(value?: string | null): MonthParts | null {
  if (!isMonthKey(value)) {
    return null;
  }
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) {
    return null;
  }
  return { year, month };
}

export function toMonthKey(value?: Date | string | number | null) {
  const timestamp = toTimestamp(value);
  if (timestamp === null) {
    return null;
  }
  const date = new Date(timestamp);
  return buildMonthKey(date.getUTCFullYear(), date.getUTCMonth() + 1);
}

export function compareMonthKeys(left?: string | null, right?: string | null) {
  const leftMonth = parseMonthKey(left);
  const rightMonth = parseMonthKey(right);
  if (!leftMonth || !rightMonth) {
    return 0;
  }
  if (leftMonth.year !== rightMonth.year) {
    return leftMonth.year - rightMonth.year;
  }
  return leftMonth.month - rightMonth.month;
}

export function shiftMonthKey(monthKey: string, offset: number) {
  const parsed = parseMonthKey(monthKey);
  if (!parsed || !Number.isInteger(offset)) {
    return null;
  }
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1 + offset, 1));
  return buildMonthKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1);
}

export function getCurrentMonthKey(date = new Date()) {
  return buildMonthKey(date.getUTCFullYear(), date.getUTCMonth() + 1);
}

export function getMonthDateRange(monthKey: string) {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) {
    return null;
  }
  const start = new Date(Date.UTC(parsed.year, parsed.month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(parsed.year, parsed.month, 1, 0, 0, 0, 0));
  return { start, end };
}

export function clampRecurringDay(dayOfMonth: number, monthKey: string) {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) {
    return Math.min(31, Math.max(1, Math.trunc(dayOfMonth || 1)));
  }
  const lastDay = new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
  return Math.min(lastDay, Math.max(1, Math.trunc(dayOfMonth || 1)));
}

export function buildRecurringOccurrenceIso(monthKey: string, dayOfMonth: number) {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) {
    return new Date().toISOString();
  }
  const resolvedDay = clampRecurringDay(dayOfMonth, monthKey);
  return new Date(Date.UTC(parsed.year, parsed.month - 1, resolvedDay, 12, 0, 0, 0)).toISOString();
}

export function isRecurringExpenseActiveForMonth(params: {
  startMonth: string;
  archivedAt?: string | null;
  monthKey: string;
}) {
  if (!isMonthKey(params.startMonth) || !isMonthKey(params.monthKey)) {
    return false;
  }
  if (compareMonthKeys(params.startMonth, params.monthKey) > 0) {
    return false;
  }
  if (!params.archivedAt) {
    return true;
  }
  const archivedMonth = toMonthKey(params.archivedAt);
  if (!archivedMonth) {
    return true;
  }
  return compareMonthKeys(archivedMonth, params.monthKey) > 0;
}
