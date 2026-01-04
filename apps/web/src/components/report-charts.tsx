"use client";

import { cn } from "@/lib/utils";

type LineChartProps = {
  values: number[];
  className?: string;
};

function buildLinePoints(values: number[]) {
  if (values.length === 0) {
    return "";
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? 100 / (values.length - 1) : 0;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = 40 - ((value - min) / range) * 36 - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function LineChart({ values, className }: LineChartProps) {
  const points = buildLinePoints(values);
  return (
    <svg viewBox="0 0 100 40" className={cn("h-24 w-full", className)}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

type Series = {
  label: string;
  values: number[];
  className: string;
};

export function MultiLineChart({ series }: { series: Series[] }) {
  const allValues = series.flatMap((item) => item.values);
  if (allValues.length === 0) {
    return <div className="h-24 rounded-lg border border-dashed border-border" />;
  }
  const max = Math.max(...allValues);
  const min = Math.min(...allValues);
  const range = max - min || 1;

  const buildPoints = (values: number[]) => {
    if (values.length === 0) return "";
    const step = values.length > 1 ? 100 / (values.length - 1) : 0;
    return values
      .map((value, index) => {
        const x = index * step;
        const y = 40 - ((value - min) / range) * 36 - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  return (
    <svg viewBox="0 0 100 40" className="h-24 w-full">
      {series.map((item) => (
        <polyline
          key={item.label}
          points={buildPoints(item.values)}
          fill="none"
          stroke="currentColor"
          className={item.className}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

export function BarPairChart({ income, expense }: { income: number[]; expense: number[] }) {
  const max = Math.max(1, ...income, ...expense);
  return (
    <div className="flex h-24 items-end gap-2">
      {income.map((value, index) => {
        const incomeHeight = Math.round((value / max) * 100);
        const expenseHeight = Math.round((expense[index] / max) * 100);
        return (
          <div key={`bar-${index}`} className="flex h-full w-full flex-1 items-end gap-1">
            <div className="flex w-1/2 items-end">
              <div className="w-full rounded-full bg-emerald-500/80" style={{ height: `${incomeHeight}%` }} />
            </div>
            <div className="flex w-1/2 items-end">
              <div className="w-full rounded-full bg-red-500/70" style={{ height: `${expenseHeight}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

type PieSlice = {
  label: string;
  value: number;
  className: string;
};

export function PieChart({ slices }: { slices: PieSlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 100 100" className="h-32 w-32">
      {slices.map((slice) => {
        const ratio = slice.value / total;
        const dash = ratio * circumference;
        const dashArray = `${dash} ${circumference - dash}`;
        const circle = (
          <circle
            key={slice.label}
            r={radius}
            cx="50"
            cy="50"
            fill="transparent"
            stroke="currentColor"
            className={slice.className}
            strokeWidth="12"
            strokeDasharray={dashArray}
            strokeDashoffset={-offset}
            strokeLinecap="round"
          />
        );
        offset += dash;
        return circle;
      })}
    </svg>
  );
}

export function Gauge({ value }: { value: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const half = circumference / 2;
  const progress = Math.min(100, Math.max(0, value));
  const dash = (progress / 100) * half;
  const dashArray = `${dash} ${circumference - dash}`;

  return (
    <svg viewBox="0 0 100 60" className="h-24 w-40">
      <circle
        r={radius}
        cx="50"
        cy="50"
        fill="transparent"
        stroke="currentColor"
        className="text-muted-foreground"
        strokeWidth="10"
        strokeDasharray={`${half} ${circumference}`}
        strokeDashoffset={half}
        transform="rotate(180 50 50)"
      />
      <circle
        r={radius}
        cx="50"
        cy="50"
        fill="transparent"
        stroke="currentColor"
        className="text-emerald-500"
        strokeWidth="10"
        strokeDasharray={dashArray}
        strokeDashoffset={half}
        transform="rotate(180 50 50)"
        strokeLinecap="round"
      />
      <text x="50" y="48" textAnchor="middle" className="fill-foreground text-sm font-semibold">
        {Math.round(progress)}
      </text>
    </svg>
  );
}
