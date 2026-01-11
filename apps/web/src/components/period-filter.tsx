"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { PeriodFilter } from "@/lib/period-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PeriodFilterPanelProps = {
  filter: PeriodFilter;
  onFilterChange: (next: PeriodFilter) => void;
  periodLabel: string;
  isRangeActive: boolean;
  onClearRange: () => void;
  className?: string;
  showMobileHeader?: boolean;
  onClose?: () => void;
};

export function PeriodFilterPanel({
  filter,
  onFilterChange,
  periodLabel,
  isRangeActive,
  onClearRange,
  className,
  showMobileHeader = false,
  onClose
}: PeriodFilterPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(filter.from || filter.to));

  useEffect(() => {
    if (filter.from || filter.to) {
      setAdvancedOpen(true);
    }
  }, [filter.from, filter.to]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur-sm",
        className
      )}
    >
      {showMobileHeader && (
        <div className="flex items-center justify-between pb-3">
          <span className="text-sm font-semibold text-foreground">Filtrar por periodo</span>
          {onClose && (
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Fechar
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <Label>Periodo</Label>
          <Input
            type="month"
            value={filter.month}
            onChange={(event) =>
              onFilterChange({ month: event.target.value, from: null, to: null })
            }
            className="min-w-[170px]"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAdvancedOpen((prev) => !prev)}
        >
          Filtro avancado
        </Button>

        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
          Periodo: {periodLabel}
        </span>

        {(filter.from || filter.to) && (
          <Button type="button" variant="ghost" size="sm" onClick={onClearRange}>
            Limpar intervalo
          </Button>
        )}
      </div>

      {advancedOpen && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>De</Label>
            <Input
              type="date"
              value={filter.from ?? ""}
              onChange={(event) =>
                onFilterChange({
                  ...filter,
                  from: event.target.value || null
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Ate</Label>
            <Input
              type="date"
              value={filter.to ?? ""}
              onChange={(event) =>
                onFilterChange({
                  ...filter,
                  to: event.target.value || null
                })
              }
            />
          </div>
          {isRangeActive && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Comparando com o periodo anterior equivalente.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
