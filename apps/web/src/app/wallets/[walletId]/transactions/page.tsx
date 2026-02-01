"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { TransactionType } from "@gf/shared";
import { ArrowDownRight, ArrowUpRight, Repeat } from "lucide-react";
import { db, safeDexie, type TransactionLocal } from "@/lib/db";
import { formatDate } from "@/lib/date";
import { getCategoryIcon } from "@/lib/category-icons";
import { usePeriodFilter } from "@/lib/period-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PeriodFilterPanel } from "@/components/period-filter";

function formatBRL(amountCents: number) {
  return (amountCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function toTimestamp(value?: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

function toServerSeq(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function compareTransactions(a: TransactionLocal, b: TransactionLocal) {
  const aSeq = toServerSeq(a.serverSeq ?? null);
  const bSeq = toServerSeq(b.serverSeq ?? null);
  if (aSeq !== null && bSeq !== null && aSeq !== bSeq) {
    return bSeq - aSeq;
  }

  const aOccurred = toTimestamp(a.occurredAt);
  const bOccurred = toTimestamp(b.occurredAt);
  if (aOccurred !== null && bOccurred !== null && aOccurred !== bOccurred) {
    return bOccurred - aOccurred;
  }

  const aCreated = toTimestamp(a.createdAt ?? a.updatedAt ?? null);
  const bCreated = toTimestamp(b.createdAt ?? b.updatedAt ?? null);
  if (aCreated !== null && bCreated !== null && aCreated !== bCreated) {
    return bCreated - aCreated;
  }
  if (aCreated !== null && bCreated === null) {
    return -1;
  }
  if (bCreated !== null && aCreated === null) {
    return 1;
  }

  return a.id.localeCompare(b.id);
}

export default function TransactionsPage({ params }: { params: { walletId: string } }) {
  const { walletId } = params;
  const { filter, setFilter, period, clearRange } = usePeriodFilter(walletId);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

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

  const categoryMap = useMemo(() => {
    return new Map((categories ?? []).map((category) => [category.id, category]));
  }, [categories]);

  const filtered = useMemo(() => {
    if (!transactions) return [];
    const periodStart = period.start.getTime();
    const periodEnd = period.end.getTime();
    return transactions.filter((tx) => {
      const occurred = toTimestamp(tx.occurredAt);
      return occurred !== null && occurred >= periodStart && occurred < periodEnd;
    });
  }, [period.end, period.start, transactions]);

  const sorted = useMemo(() => [...filtered].sort(compareTransactions), [filtered]);

  return (
    <div className="grid gap-6 animate-rise">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Todas as Transacoes</h2>
          <p className="text-sm text-muted-foreground">Historico completo de receitas e despesas</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:hidden"
            onClick={() => setMobileFilterOpen((prev) => !prev)}
          >
            {mobileFilterOpen ? "Fechar filtros" : "Filtrar"}
          </Button>
          <Button asChild variant="create" className="w-full sm:w-auto">
            <Link href={`/wallets/${walletId}/transactions/new`}>Nova transacao</Link>
          </Button>
        </div>
      </div>

      {mobileFilterOpen && (
        <div className="sm:hidden">
          <PeriodFilterPanel
            filter={filter}
            onFilterChange={setFilter}
            periodLabel={period.label}
            isRangeActive={period.isRange}
            onClearRange={clearRange}
            showMobileHeader
            onClose={() => setMobileFilterOpen(false)}
            className="animate-rise"
          />
        </div>
      )}

      <div className="hidden sm:block">
        <PeriodFilterPanel
          filter={filter}
          onFilterChange={setFilter}
          periodLabel={period.label}
          isRangeActive={period.isRange}
          onClearRange={clearRange}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listagem de Transacoes ({sorted.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.length === 0 && <p className="text-sm text-muted-foreground">Sem transacoes no periodo.</p>}
          {sorted.map((tx) => (
            <Link
              key={tx.id}
              href={`/wallets/${walletId}/transactions/${tx.id}/edit`}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 transition hover:shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    tx.type === TransactionType.EXPENSE
                      ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                      : tx.type === TransactionType.TRANSFER
                      ? "bg-[var(--color-info-soft)] text-[var(--color-info)]"
                      : "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                  }`}
                >
                  {tx.type === TransactionType.EXPENSE ? (
                    <ArrowDownRight className="h-4 w-4" />
                  ) : tx.type === TransactionType.TRANSFER ? (
                    <Repeat className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium sm:whitespace-normal">{tx.description || "Sem descricao"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(tx.occurredAt)}</span>
                    <span className="flex items-center gap-2 rounded-full border border-border px-2 py-0.5 text-[10px]">
                      {tx.categoryId && categoryMap.get(tx.categoryId) ? (
                        <>
                          {(() => {
                            const category = categoryMap.get(tx.categoryId);
                            if (!category) return null;
                            const Icon = getCategoryIcon(category.icon);
                            const displayColor = category.color ?? "#4fa2ff";
                            return (
                              <span
                                className="flex h-5 w-5 items-center justify-center rounded-full"
                                style={{ backgroundColor: `${displayColor}1A`, color: displayColor }}
                              >
                                <Icon className="h-3 w-3" />
                              </span>
                            );
                          })()}
                          {categoryMap.get(tx.categoryId)?.name ?? "Categoria"}
                        </>
                      ) : (
                        "Sem categoria"
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex w-full items-center justify-between gap-3 text-sm sm:w-auto sm:justify-start">
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {tx.type === TransactionType.EXPENSE
                    ? "Despesa"
                    : tx.type === TransactionType.TRANSFER
                    ? "Transferencia"
                    : "Receita"}
                </span>
                <span
                  className={
                    tx.type === TransactionType.EXPENSE
                      ? "text-[var(--color-danger)]"
                      : tx.type === TransactionType.TRANSFER
                      ? "text-[var(--color-info)]"
                      : "text-[var(--color-success)]"
                  }
                >
                  {formatBRL(tx.amountCents)}
                </span>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
