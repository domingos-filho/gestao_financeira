"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart as RechartsPieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart as RechartsLineChart,
  ReferenceLine
} from "recharts";
import { cn } from "@/lib/utils";

type ChartValueFormatter = (value: number) => string;

function defaultFormatValue(value: number) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 0
  });
}

const CHART_COLORS = {
  success: "var(--color-success)",
  successStrong: "var(--color-success-strong)",
  danger: "var(--color-danger)",
  dangerStrong: "var(--color-danger-strong)",
  info: "var(--color-info)",
  infoSoft: "var(--color-info-soft)",
  warning: "var(--color-warning)",
  warningSoft: "var(--color-warning-soft)",
  purple: "var(--color-purple)",
  border: "var(--color-border)",
  foreground: "var(--color-fg)",
  mutedForeground: "var(--color-muted-fg)",
  muted: "var(--color-muted)",
  card: "var(--color-card)"
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTooltipLabel(label: unknown) {
  if (typeof label === "string") {
    return label;
  }
  if (typeof label === "number") {
    return String(label);
  }
  return "";
}

function normalizeValue(value: unknown) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function buildChartDomain(values: number[]) {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  if (min !== max) {
    return { min, max };
  }

  const padding = min === 0 ? 1 : Math.max(Math.abs(min) * 0.1, 1);
  return {
    min: min - padding,
    max: max + padding
  };
}

function ChartTooltip({
  active,
  payload,
  label,
  formatValue
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: unknown; color?: string }>;
  label?: unknown;
  formatValue: ChartValueFormatter;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-xl border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
      style={{ color: CHART_COLORS.foreground }}
    >
      {formatTooltipLabel(label) ? (
        <p className="font-semibold text-foreground">{formatTooltipLabel(label)}</p>
      ) : null}
      <div className="mt-2 space-y-1">
        {payload.map((entry, index) => {
          const value = normalizeValue(entry.value);
          const color = entry.color ?? CHART_COLORS.info;
          const name = entry.name ?? `Serie ${index + 1}`;
          return (
            <div key={`${name}-${index}`} className="flex items-center justify-between gap-4">
              <span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="truncate">{name}</span>
              </span>
              <span className="font-semibold text-foreground">{formatValue(value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type WaterfallStep = {
  label: string;
  value: number;
  kind: "base" | "delta" | "total";
  className?: string;
};

type WaterfallLayoutItem = {
  step: WaterfallStep;
  x: number;
  y: number;
  width: number;
  height: number;
  startValue: number;
  endValue: number;
  cumulative: number;
};

export function buildWaterfallLayout(
  steps: WaterfallStep[],
  width = 100,
  height = 60,
  padding = { left: 12, right: 4, top: 6, bottom: 12 }
) {
  const cumulativeValues: number[] = [];
  const layoutItems: WaterfallLayoutItem[] = [];
  let cumulative = 0;

  for (const step of steps) {
    const startValue = step.kind === "delta" ? cumulative : step.kind === "base" ? 0 : 0;
    const endValue =
      step.kind === "delta" ? cumulative + step.value : step.kind === "base" ? step.value : step.value;
    cumulative = endValue;
    cumulativeValues.push(cumulative);
    layoutItems.push({
      step,
      startValue,
      endValue,
      cumulative,
      x: 0,
      y: 0,
      width: 0,
      height: 0
    });
  }

  const domainValues = [0, ...cumulativeValues, ...steps.map((step) => step.value)];
  const min = Math.min(...domainValues);
  const max = Math.max(...domainValues);
  const range = max - min || 1;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const stepWidth = steps.length > 0 ? innerWidth / steps.length : innerWidth;
  const barWidth = Math.min(stepWidth * 0.58, 12);

  const yForValue = (value: number) => {
    const clamped = clamp(value, min, max);
    const progress = (clamped - min) / range;
    return height - padding.bottom - progress * innerHeight;
  };

  layoutItems.forEach((item, index) => {
    const yStart = yForValue(item.startValue);
    const yEnd = yForValue(item.endValue);
    item.x = padding.left + index * stepWidth + (stepWidth - barWidth) / 2;
    item.y = Math.min(yStart, yEnd);
    item.width = barWidth;
    item.height = Math.max(0.5, Math.abs(yStart - yEnd));
  });

  const connectors = layoutItems.slice(0, -1).map((item, index) => {
    const next = layoutItems[index + 1]!;
    const y = yForValue(item.cumulative);
    return {
      x1: item.x + item.width,
      y1: y,
      x2: next.x,
      y2: y
    };
  });

  return {
    scale: {
      domain: { min, max, range },
      padding,
      innerWidth,
      innerHeight,
      yForValue
    },
    items: layoutItems,
    connectors
  };
}

export type TreemapItem = {
  label: string;
  value: number;
  className: string;
};

type TreemapRect = {
  item: TreemapItem;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function buildTreemapLayout(items: TreemapItem[], width = 100, height = 60) {
  const positiveItems = items.filter((item) => item.value > 0);
  if (positiveItems.length === 0) {
    return [] as TreemapRect[];
  }

  const rows: [TreemapItem[], TreemapItem[]] = [[], []];
  const rowTotals: [number, number] = [0, 0];

  for (const item of positiveItems.sort((left, right) => right.value - left.value)) {
    const targetRow = rowTotals[0] <= rowTotals[1] ? 0 : 1;
    rows[targetRow].push(item);
    rowTotals[targetRow] += item.value;
  }

  const total = rowTotals[0] + rowTotals[1];
  const rects: TreemapRect[] = [];
  let y = 0;

  rows.forEach((row, rowIndex) => {
    if (row.length === 0) {
      return;
    }

    const rowTotal = row.reduce((sum, item) => sum + item.value, 0) || 1;
    const rowTotalValue = rowTotals[rowIndex]!;
    const rowHeight = rowIndex === rows.length - 1 ? height - y : (rowTotalValue / total) * height;
    let x = 0;

    row.forEach((item, index) => {
      const cellWidth = index === row.length - 1 ? width - x : (item.value / rowTotal) * width;
      rects.push({
        item,
        x,
        y,
        width: cellWidth,
        height: rowHeight
      });
      x += cellWidth;
    });

    y += rowHeight;
  });

  return rects;
}

function BaseChartShell({
  children,
  emptyLabel
}: {
  children?: React.ReactNode;
  emptyLabel?: string;
}) {
  return (
    <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border bg-card/30 text-sm text-muted-foreground">
      {emptyLabel ?? children}
    </div>
  );
}

export function LineChart({
  values,
  labels,
  color = CHART_COLORS.success,
  className,
  formatValue = defaultFormatValue,
  emptyLabel = "Sem dados no periodo.",
  showArea = true,
  showDots = true
}: {
  values: number[];
  labels?: string[];
  color?: string;
  className?: string;
  formatValue?: ChartValueFormatter;
  emptyLabel?: string;
  showArea?: boolean;
  showDots?: boolean;
}) {
  if (values.length === 0) {
    return <BaseChartShell emptyLabel={emptyLabel} />;
  }

  const data = values.map((value, index) => ({
    label: labels?.[index] ?? String(index + 1),
    value
  }));

  const domain = buildChartDomain(values);

  return (
    <div className={cn("h-56 w-full sm:h-64", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.border} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: CHART_COLORS.mutedForeground, fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={18}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: CHART_COLORS.mutedForeground, fontSize: 11 }}
            tickFormatter={formatValue}
            domain={[domain.min, domain.max]}
            width={72}
          />
          <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
          <ReferenceLine y={0} stroke={CHART_COLORS.border} />
          {showArea ? (
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={0.16}
              strokeWidth={2.5}
              dot={showDots ? { r: 3.5, strokeWidth: 2, fill: color } : false}
              activeDot={{ r: 4.5 }}
              name="Valor"
            />
          ) : (
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              dot={showDots ? { r: 3.5, strokeWidth: 2, fill: color } : false}
              activeDot={{ r: 4.5 }}
              name="Valor"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type Series = {
  label: string;
  values: number[];
  className: string;
};

export function MultiLineChart({
  series,
  labels,
  formatValue = defaultFormatValue,
  emptyLabel = "Sem dados no periodo."
}: {
  series: Series[];
  labels?: string[];
  formatValue?: ChartValueFormatter;
  emptyLabel?: string;
}) {
  const allValues = series.flatMap((item) => item.values);
  if (allValues.length === 0) {
    return <BaseChartShell emptyLabel={emptyLabel} />;
  }

  const dataLength = labels?.length ?? Math.max(...series.map((item) => item.values.length));
  const data = Array.from({ length: dataLength }, (_, index) => {
    const point: Record<string, string | number> = {
      label: labels?.[index] ?? String(index + 1)
    };
    series.forEach((item, seriesIndex) => {
      point[`series-${seriesIndex}`] = item.values[index] ?? 0;
    });
    return point;
  });

  const domain = buildChartDomain(allValues);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {series.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-current" style={{ backgroundColor: item.className }} />
            <span className="max-w-32 truncate">{item.label}</span>
          </span>
        ))}
      </div>
      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.border} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: CHART_COLORS.mutedForeground, fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={18}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: CHART_COLORS.mutedForeground, fontSize: 11 }}
              tickFormatter={formatValue}
              domain={[domain.min, domain.max]}
              width={72}
            />
            <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
            <ReferenceLine y={0} stroke={CHART_COLORS.border} />
            {series.map((item, index) => (
              <Line
                key={item.label}
                type="monotone"
                dataKey={`series-${index}`}
                stroke={item.className}
                strokeWidth={2.25}
                dot={{ r: 2.8, strokeWidth: 2, fill: item.className }}
                activeDot={{ r: 4.2 }}
                name={item.label}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function BarPairChart({
  income,
  expense,
  labels,
  formatValue = defaultFormatValue,
  emptyLabel = "Sem dados no periodo."
}: {
  income: number[];
  expense: number[];
  labels?: string[];
  formatValue?: ChartValueFormatter;
  emptyLabel?: string;
}) {
  const length = Math.max(income.length, expense.length);
  if (length === 0) {
    return <BaseChartShell emptyLabel={emptyLabel} />;
  }

  const data = Array.from({ length }, (_, index) => ({
    label: labels?.[index] ?? String(index + 1),
    income: income[index] ?? 0,
    expense: expense[index] ?? 0
  }));

  const allValues = data.flatMap((item) => [item.income, item.expense]);
  const domain = buildChartDomain(allValues);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.successStrong }} />
          Receitas
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.dangerStrong }} />
          Despesas
        </span>
      </div>
      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={18}>
            <CartesianGrid stroke={CHART_COLORS.border} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: CHART_COLORS.mutedForeground, fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={18}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: CHART_COLORS.mutedForeground, fontSize: 11 }}
              tickFormatter={formatValue}
              domain={[domain.min, domain.max]}
              width={72}
            />
            <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
            <ReferenceLine y={0} stroke={CHART_COLORS.border} />
            <Bar dataKey="income" fill={CHART_COLORS.successStrong} name="Receitas" radius={6} barSize={12} />
            <Bar dataKey="expense" fill={CHART_COLORS.dangerStrong} name="Despesas" radius={6} barSize={12} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function WaterfallChart({
  steps,
  formatValue = defaultFormatValue,
  emptyLabel = "Sem dados no periodo."
}: {
  steps: WaterfallStep[];
  formatValue?: ChartValueFormatter;
  emptyLabel?: string;
}) {
  if (steps.length === 0) {
    return <BaseChartShell emptyLabel={emptyLabel} />;
  }

  const data = steps.map((step) => ({
    label: step.label,
    value: step.value,
    name: step.label,
    fill:
      step.kind === "base"
        ? CHART_COLORS.info
        : step.kind === "total"
        ? CHART_COLORS.warning
        : step.value >= 0
        ? CHART_COLORS.successStrong
        : CHART_COLORS.dangerStrong
  }));

  const allValues = data.map((item) => item.value);
  const domain = buildChartDomain(allValues);

  return (
    <div className="h-56 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={18}>
          <CartesianGrid stroke={CHART_COLORS.border} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: CHART_COLORS.mutedForeground, fontSize: 11 }}
            interval={0}
            minTickGap={12}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: CHART_COLORS.mutedForeground, fontSize: 11 }}
            tickFormatter={formatValue}
            domain={[domain.min, domain.max]}
            width={72}
          />
          <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
          <ReferenceLine y={0} stroke={CHART_COLORS.border} />
          <Bar dataKey="value" name="Valor" radius={6} barSize={20}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TreemapChart({
  items,
  formatValue = defaultFormatValue,
  emptyLabel = "Sem dados no periodo."
}: {
  items: TreemapItem[];
  formatValue?: ChartValueFormatter;
  emptyLabel?: string;
}) {
  const positiveItems = items.filter((item) => item.value > 0);
  const total = positiveItems.reduce((sum, item) => sum + item.value, 0);

  if (positiveItems.length === 0 || total === 0) {
    return <BaseChartShell emptyLabel={emptyLabel} />;
  }

  return (
    <div className="space-y-3">
      <div className="relative h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
            <Pie
              data={positiveItems}
              dataKey="value"
              nameKey="label"
              innerRadius="58%"
              outerRadius="84%"
              paddingAngle={2}
            >
              {positiveItems.map((item) => (
                <Cell key={item.label} fill={item.className} />
              ))}
            </Pie>
          </RechartsPieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-card/70 px-4 py-3 text-center shadow-sm backdrop-blur-sm">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Total</div>
            <div className="text-base font-semibold text-foreground">{formatValue(total)}</div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {positiveItems.map((item) => (
          <span key={item.label} className="inline-flex max-w-full items-center gap-1">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.className }} />
            <span className="truncate">{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

type PieSlice = {
  label: string;
  value: number;
  className: string;
};

export function PieChart({ slices }: { slices: PieSlice[] }) {
  const positiveSlices = slices.filter((slice) => slice.value > 0);
  const total = positiveSlices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="relative h-48 w-full sm:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Tooltip content={<ChartTooltip formatValue={defaultFormatValue} />} />
          <Pie
            data={positiveSlices}
            dataKey="value"
            nameKey="label"
            innerRadius="58%"
            outerRadius="84%"
            paddingAngle={2}
          >
            {positiveSlices.map((slice) => (
              <Cell key={slice.label} fill={slice.className} />
            ))}
          </Pie>
        </RechartsPieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="rounded-full bg-card/70 px-4 py-3 text-center shadow-sm backdrop-blur-sm">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Total</div>
          <div className="text-base font-semibold text-foreground">{total > 0 ? "100%" : "0%"}</div>
        </div>
      </div>
    </div>
  );
}

export function Gauge({ value }: { value: number }) {
  const progress = Math.min(100, Math.max(0, value));
  const color =
    progress >= 70 ? CHART_COLORS.successStrong : progress >= 40 ? CHART_COLORS.warning : CHART_COLORS.dangerStrong;

  return (
    <div className="relative h-28 w-44 max-w-full sm:h-32 sm:w-48">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={[{ name: "Saude", value: progress }]}
          innerRadius="78%"
          outerRadius="100%"
          startAngle={180}
          endAngle={0}
        >
          <RadialBar dataKey="value" background fill={color} cornerRadius={999} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-2">
        <div className="text-center">
          <div className="text-3xl font-semibold text-foreground">{Math.round(progress)}</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Indice</div>
        </div>
      </div>
    </div>
  );
}
