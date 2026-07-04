"use client";

import { cn } from "@/lib/utils";

type ChartValueFormatter = (value: number) => string;

type Padding = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const DEFAULT_PADDING: Padding = {
  left: 12,
  right: 4,
  top: 6,
  bottom: 12
};

function defaultFormatValue(value: number) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 0
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getVisibleLabelIndices(length: number, maxLabels = 6) {
  if (length <= 0) {
    return [] as number[];
  }
  if (length <= maxLabels) {
    return Array.from({ length }, (_, index) => index);
  }

  const candidates = new Set<number>();
  const step = (length - 1) / (maxLabels - 1);
  for (let index = 0; index < maxLabels; index += 1) {
    candidates.add(Math.round(index * step));
  }
  return Array.from(candidates).sort((left, right) => left - right);
}

export function buildLinearDomain(values: number[]) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  const min = Math.min(0, ...finiteValues);
  const max = Math.max(0, ...finiteValues);
  return {
    min,
    max,
    range: max - min || 1
  };
}

function buildTicks(domain: { min: number; max: number; range: number }, tickCount = 4) {
  if (tickCount <= 1) {
    return [{ value: domain.min, ratio: 0 }];
  }

  return Array.from({ length: tickCount }, (_, index) => {
    const ratio = index / (tickCount - 1);
    return {
      value: domain.max - domain.range * ratio,
      ratio
    };
  });
}

type LinearScale = {
  domain: {
    min: number;
    max: number;
    range: number;
  };
  padding: Padding;
  innerWidth: number;
  innerHeight: number;
  xForIndex: (index: number, length: number) => number;
  yForValue: (value: number) => number;
};

function createLinearScale(
  values: number[],
  width = 100,
  height = 60,
  padding: Padding = DEFAULT_PADDING
): LinearScale {
  const domain = buildLinearDomain(values);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  return {
    domain,
    padding,
    innerWidth,
    innerHeight,
    xForIndex(index: number, length: number) {
      if (length <= 1) {
        return padding.left + innerWidth / 2;
      }
      return padding.left + (index / (length - 1)) * innerWidth;
    },
    yForValue(value: number) {
      const clamped = clamp(value, domain.min, domain.max);
      const progress = (clamped - domain.min) / domain.range;
      return height - padding.bottom - progress * innerHeight;
    }
  };
}

function buildPoints(values: number[], scale: LinearScale) {
  return values.map((value, index) => ({
    x: scale.xForIndex(index, values.length),
    y: scale.yForValue(value),
    value
  }));
}

function pointsToPath(points: { x: number; y: number }[]) {
  if (points.length === 0) {
    return "";
  }
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function buildAreaPath(points: { x: number; y: number }[], baselineY: number) {
  if (points.length === 0) {
    return "";
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;
  return [
    `M ${first.x.toFixed(2)} ${baselineY.toFixed(2)}`,
    `L ${first.x.toFixed(2)} ${first.y.toFixed(2)}`,
    ...points.slice(1).map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
    `L ${last.x.toFixed(2)} ${baselineY.toFixed(2)}`,
    "Z"
  ].join(" ");
}

function buildAxisLabel(value: number, formatValue: ChartValueFormatter) {
  const raw = formatValue(value);
  return raw.length > 10 ? raw.replace(/,00$/, "") : raw;
}

type BaseChartProps = {
  className?: string;
  labels?: string[];
  formatValue?: ChartValueFormatter;
  emptyLabel?: string;
};

type LineChartProps = BaseChartProps & {
  values: number[];
  showArea?: boolean;
  showDots?: boolean;
};

export function LineChart({
  values,
  labels,
  className,
  formatValue = defaultFormatValue,
  emptyLabel = "Sem dados no periodo.",
  showArea = true,
  showDots = true
}: LineChartProps) {
  if (values.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground sm:h-28">
        {emptyLabel}
      </div>
    );
  }

  const scale = createLinearScale(values);
  const points = buildPoints(values, scale);
  const linePath = pointsToPath(points);
  const areaPath = buildAreaPath(points, scale.yForValue(0));
  const yTicks = buildTicks(scale.domain, 4);
  const visibleLabelIndices = new Set(getVisibleLabelIndices(values.length));

  return (
    <svg
      viewBox="0 0 100 60"
      preserveAspectRatio="none"
      className={cn("h-24 w-full sm:h-28", className)}
      role="img"
      aria-label="Grafico de linha"
    >
      {yTicks.map((tick) => {
        const y = scale.yForValue(tick.value);
        return (
          <g key={`${tick.value}-${tick.ratio}`}>
            <line
              x1={scale.padding.left}
              x2={100 - scale.padding.right}
              y1={y}
              y2={y}
              stroke="currentColor"
              className="stroke-border/40"
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={scale.padding.left - 1}
              y={y + 1.6}
              textAnchor="end"
              fill="currentColor"
              className="fill-muted-foreground text-[3px]"
            >
              {buildAxisLabel(tick.value, formatValue)}
            </text>
          </g>
        );
      })}

      <path
        d={showArea ? areaPath : ""}
        fill="currentColor"
        className={cn("opacity-[0.15]", className)}
        aria-hidden="true"
      />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        className={cn(className)}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {showDots &&
        points.map((point, index) => (
          <circle
            key={`${point.x}-${point.y}-${index}`}
            cx={point.x}
            cy={point.y}
            r="1.7"
            fill="currentColor"
            className={cn("stroke-background", className)}
            strokeWidth="0.5"
          >
            <title>{formatValue(point.value)}</title>
          </circle>
        ))}

      {labels?.map((label, index) =>
        visibleLabelIndices.has(index) ? (
          <text
            key={`${label}-${index}`}
            x={points[index]?.x ?? scale.padding.left}
            y={57.2}
            textAnchor="middle"
            fill="currentColor"
            className="fill-muted-foreground text-[3px]"
          >
            {label}
          </text>
        ) : null
      )}
    </svg>
  );
}

type Series = {
  label: string;
  values: number[];
  className: string;
};

type MultiLineChartProps = BaseChartProps & {
  series: Series[];
};

export function MultiLineChart({
  series,
  labels,
  formatValue = defaultFormatValue,
  emptyLabel = "Sem dados no periodo."
}: MultiLineChartProps) {
  const allValues = series.flatMap((item) => item.values);
  if (allValues.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground sm:h-28">
        {emptyLabel}
      </div>
    );
  }

  const scale = createLinearScale(allValues);
  const yTicks = buildTicks(scale.domain, 4);
  const visibleLabelIndices = new Set(getVisibleLabelIndices(labels?.length ?? allValues.length));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {series.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full bg-current", item.className)} />
            <span>{item.label}</span>
          </span>
        ))}
      </div>
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        className="h-24 w-full sm:h-28"
        role="img"
        aria-label="Grafico de multiplas linhas"
      >
        {yTicks.map((tick) => {
          const y = scale.yForValue(tick.value);
          return (
            <g key={`${tick.value}-${tick.ratio}`}>
              <line
                x1={scale.padding.left}
                x2={100 - scale.padding.right}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="stroke-border/40"
                strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={scale.padding.left - 1}
                y={y + 1.6}
                textAnchor="end"
                fill="currentColor"
                className="fill-muted-foreground text-[3px]"
              >
                {buildAxisLabel(tick.value, formatValue)}
              </text>
            </g>
          );
        })}

        {series.map((item) => {
          const points = buildPoints(item.values, scale);
          return (
            <path
              key={item.label}
              d={pointsToPath(points)}
              fill="none"
              stroke="currentColor"
              className={cn(item.className)}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {labels?.map((label, index) =>
          visibleLabelIndices.has(index) ? (
            <text
              key={`${label}-${index}`}
              x={scale.xForIndex(index, labels.length)}
              y={57.2}
              textAnchor="middle"
              fill="currentColor"
              className="fill-muted-foreground text-[3px]"
            >
              {label}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

type BarPairChartProps = BaseChartProps & {
  income: number[];
  expense: number[];
};

export function BarPairChart({
  income,
  expense,
  labels,
  formatValue = defaultFormatValue,
  emptyLabel = "Sem dados no periodo."
}: BarPairChartProps) {
  const length = Math.max(income.length, expense.length);
  if (length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground sm:h-28">
        {emptyLabel}
      </div>
    );
  }

  const seriesValues = Array.from({ length }, (_, index) => [income[index] ?? 0, expense[index] ?? 0]).flat();
  const scale = createLinearScale(seriesValues);
  const yTicks = buildTicks(scale.domain, 4);
  const groupWidth = scale.innerWidth / length;
  const barWidth = Math.min(groupWidth * 0.26, 7);
  const barGap = Math.min(groupWidth * 0.12, 2.4);
  const visibleLabelIndices = new Set(getVisibleLabelIndices(labels?.length ?? length));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[var(--color-success-strong)]" />
          Receitas
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[var(--color-danger-strong)]" />
          Despesas
        </span>
      </div>

      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        className="h-24 w-full sm:h-28"
        role="img"
        aria-label="Grafico de barras agrupadas"
      >
        {yTicks.map((tick) => {
          const y = scale.yForValue(tick.value);
          return (
            <g key={`${tick.value}-${tick.ratio}`}>
              <line
                x1={scale.padding.left}
                x2={100 - scale.padding.right}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="stroke-border/40"
                strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={scale.padding.left - 1}
                y={y + 1.6}
                textAnchor="end"
                fill="currentColor"
                className="fill-muted-foreground text-[3px]"
              >
                {buildAxisLabel(tick.value, formatValue)}
              </text>
            </g>
          );
        })}

        {Array.from({ length }, (_, index) => {
          const groupStart = scale.padding.left + index * groupWidth;
          const incomeValue = income[index] ?? 0;
          const expenseValue = expense[index] ?? 0;
          const incomeHeight = scale.domain.max > 0 ? (incomeValue / scale.domain.max) * scale.innerHeight : 0;
          const expenseHeight = scale.domain.max > 0 ? (expenseValue / scale.domain.max) * scale.innerHeight : 0;
          const incomeY = 60 - scale.padding.bottom - incomeHeight;
          const expenseY = 60 - scale.padding.bottom - expenseHeight;
          const incomeX = groupStart + (groupWidth - barWidth * 2 - barGap) / 2;
          const expenseX = incomeX + barWidth + barGap;
          const xLabel = labels?.[index] ?? String(index + 1);

          return (
            <g key={`bar-${index}`}>
              <rect
                x={incomeX}
                y={incomeY}
                width={barWidth}
                height={Math.max(incomeHeight, incomeValue > 0 ? 0.6 : 0)}
                rx="1.5"
                fill="currentColor"
                className="text-[var(--color-success-strong)]"
                vectorEffect="non-scaling-stroke"
              >
                <title>{formatValue(incomeValue)}</title>
              </rect>
              <rect
                x={expenseX}
                y={expenseY}
                width={barWidth}
                height={Math.max(expenseHeight, expenseValue > 0 ? 0.6 : 0)}
                rx="1.5"
                fill="currentColor"
                className="text-[var(--color-danger-strong)]"
                vectorEffect="non-scaling-stroke"
              >
                <title>{formatValue(expenseValue)}</title>
              </rect>
              {visibleLabelIndices.has(index) ? (
                <text
                  x={groupStart + groupWidth / 2}
                  y={57.2}
                  textAnchor="middle"
                  fill="currentColor"
                  className="fill-muted-foreground text-[3px]"
                >
                  {xLabel}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
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
  padding: Padding = DEFAULT_PADDING
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

  const scale = createLinearScale([0, ...cumulativeValues, ...steps.map((step) => step.value)], width, height, padding);
  const innerWidth = width - padding.left - padding.right;
  const stepWidth = steps.length > 0 ? innerWidth / steps.length : innerWidth;
  const barWidth = Math.min(stepWidth * 0.58, 12);

  layoutItems.forEach((item, index) => {
    const yStart = scale.yForValue(item.startValue);
    const yEnd = scale.yForValue(item.endValue);
    item.x = padding.left + index * stepWidth + (stepWidth - barWidth) / 2;
    item.y = Math.min(yStart, yEnd);
    item.width = barWidth;
    item.height = Math.max(0.5, Math.abs(yStart - yEnd));
  });

  const connectors = layoutItems.slice(0, -1).map((item, index) => {
    const next = layoutItems[index + 1]!;
    const y = scale.yForValue(item.cumulative);
    return {
      x1: item.x + item.width,
      y1: y,
      x2: next.x,
      y2: y
    };
  });

  return {
    scale,
    items: layoutItems,
    connectors
  };
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
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground sm:h-28">
        {emptyLabel}
      </div>
    );
  }

  const layout = buildWaterfallLayout(steps);
  const visibleLabelIndices = new Set(getVisibleLabelIndices(steps.length));

  return (
    <svg
      viewBox="0 0 100 60"
      preserveAspectRatio="none"
      className="h-24 w-full sm:h-28"
      role="img"
      aria-label="Grafico de cascata"
    >
      {buildTicks(layout.scale.domain, 4).map((tick) => {
        const y = layout.scale.yForValue(tick.value);
        return (
          <g key={`${tick.value}-${tick.ratio}`}>
            <line
              x1={layout.scale.padding.left}
              x2={100 - layout.scale.padding.right}
              y1={y}
              y2={y}
              stroke="currentColor"
              className="stroke-border/40"
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={layout.scale.padding.left - 1}
              y={y + 1.6}
              textAnchor="end"
              fill="currentColor"
              className="fill-muted-foreground text-[3px]"
            >
              {buildAxisLabel(tick.value, formatValue)}
            </text>
          </g>
        );
      })}

      {layout.connectors.map((connector, index) => (
        <line
          key={`connector-${index}`}
          x1={connector.x1}
          y1={connector.y1}
          x2={connector.x2}
          y2={connector.y2}
          stroke="currentColor"
          className="stroke-border/70"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {layout.items.map((item) => {
        const valueClass =
          item.step.className ??
          (item.step.kind === "base"
            ? "text-[var(--color-info)]"
            : item.step.kind === "total"
            ? "text-[var(--color-warning)]"
            : item.step.value >= 0
            ? "text-[var(--color-success)]"
            : "text-[var(--color-danger)]");
        const valueLabel = item.step.kind === "delta" ? item.step.value : item.endValue;
        const valueY = item.step.kind === "delta" && item.step.value < 0 ? item.y + item.height + 4.5 : item.y - 1.5;

        return (
          <g key={item.step.label}>
            <rect
              x={item.x}
              y={item.y}
              width={item.width}
              height={item.height}
              rx="2"
              fill="currentColor"
              className={cn("opacity-90", valueClass)}
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${item.step.label}: ${formatValue(valueLabel)}`}</title>
            </rect>
            <text
              x={item.x + item.width / 2}
              y={clamp(valueY, 6, 56)}
              textAnchor="middle"
              fill="currentColor"
              className="fill-foreground text-[3px]"
            >
              {formatValue(valueLabel)}
            </text>
            {visibleLabelIndices.has(layout.items.indexOf(item)) ? (
              <text
                x={item.x + item.width / 2}
                y={57.2}
                textAnchor="middle"
                fill="currentColor"
                className="fill-muted-foreground text-[3px]"
              >
                {item.step.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
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

export function TreemapChart({
  items,
  formatValue = defaultFormatValue,
  emptyLabel = "Sem dados no periodo."
}: {
  items: TreemapItem[];
  formatValue?: ChartValueFormatter;
  emptyLabel?: string;
}) {
  const rects = buildTreemapLayout(items);
  if (rects.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground sm:h-28">
        {emptyLabel}
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 100 60"
      preserveAspectRatio="none"
      className="h-28 w-full sm:h-36"
      role="img"
      aria-label="Mapa de calor por categoria"
    >
      {rects.map((rect) => {
        const showText = rect.width > 14 && rect.height > 14;
        const showValue = rect.width > 20 && rect.height > 20;
        return (
          <g key={rect.item.label}>
            <rect
              x={rect.x + 0.7}
              y={rect.y + 0.7}
              width={Math.max(0, rect.width - 1.4)}
              height={Math.max(0, rect.height - 1.4)}
              rx="3"
              fill="currentColor"
              className={cn(rect.item.className, "opacity-[0.18]")}
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${rect.item.label}: ${formatValue(rect.item.value)}`}</title>
            </rect>
            {showText ? (
              <text
                x={rect.x + 3}
                y={rect.y + 6}
                fill="currentColor"
                className={cn(rect.item.className, "text-[3px]")}
              >
                {rect.item.label}
              </text>
            ) : null}
            {showValue ? (
              <text
                x={rect.x + 3}
                y={rect.y + 11}
                fill="currentColor"
                className="fill-foreground text-[3px]"
              >
                {formatValue(rect.item.value)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
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
    <svg viewBox="0 0 100 100" className="h-28 w-28 sm:h-32 sm:w-32">
      <circle
        r={radius}
        cx="50"
        cy="50"
        fill="transparent"
        stroke="currentColor"
        className="text-muted-foreground/20"
        strokeWidth="12"
      />
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
      <text x="50" y="50" textAnchor="middle" className="fill-foreground text-[8px] font-semibold">
        {total > 0 ? "100%" : "0%"}
      </text>
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
    <svg viewBox="0 0 100 60" className="h-20 w-32 max-w-full sm:h-24 sm:w-40">
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
        className="text-[var(--color-success)]"
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
