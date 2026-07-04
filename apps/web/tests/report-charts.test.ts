import { describe, expect, it } from "vitest";
import { buildTreemapLayout, buildWaterfallLayout } from "../src/components/report-charts";

describe("report chart layouts", () => {
  it("builds a waterfall layout with cumulative values", () => {
    const layout = buildWaterfallLayout([
      { label: "Saldo inicial", value: 10000, kind: "base" },
      { label: "Receitas", value: 2500, kind: "delta" },
      { label: "Despesas", value: -1500, kind: "delta" },
      { label: "Saldo final", value: 11000, kind: "total" }
    ]);

    expect(layout.items).toHaveLength(4);
    expect(layout.connectors).toHaveLength(3);
    expect(Math.round(layout.items[3]?.cumulative ?? 0)).toBe(11000);
  });

  it("builds a treemap layout for positive items only", () => {
    const rects = buildTreemapLayout([
      { label: "Moradia", value: 6000, className: "text-red-500" },
      { label: "Transporte", value: 3000, className: "text-blue-500" },
      { label: "Mercado", value: 1000, className: "text-green-500" },
      { label: "Sem valor", value: 0, className: "text-zinc-500" }
    ]);

    expect(rects).toHaveLength(3);
    expect(rects.every((rect) => rect.width > 0 && rect.height > 0)).toBe(true);
    expect(rects.reduce((sum, rect) => sum + rect.item.value, 0)).toBe(10000);
  });
});
