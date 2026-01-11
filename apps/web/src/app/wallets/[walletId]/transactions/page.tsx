"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { TransactionType } from "@gf/shared";
import { ArrowDownRight, ArrowUpRight, Repeat } from "lucide-react";
import { db, safeDexie } from "@/lib/db";
import { formatDate } from "@/lib/date";
import { getCategoryIcon } from "@/lib/category-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatBRL(amountCents: number) {
  return (amountCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

export default function TransactionsPage({ params }: { params: { walletId: string } }) {
  const { walletId } = params;

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

  const sorted = (transactions ?? []).sort((a, b) => (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""));

  return (
    <div className="grid gap-6 animate-rise">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Todas as Transacoes</h2>
          <p className="text-sm text-muted-foreground">Historico completo de receitas e despesas</p>
        </div>
        <Button asChild variant="create">
          <Link href={`/wallets/${walletId}/transactions/new`}>Nova transacao</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listagem de Transacoes ({sorted.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.length === 0 && <p className="text-sm text-muted-foreground">Sem transacoes locais.</p>}
          {sorted.map((tx) => (
            <Link
              key={tx.id}
              href={`/wallets/${walletId}/transactions/${tx.id}/edit`}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
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
                <div>
                  <p className="font-medium">{tx.description || "Sem descricao"}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
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
              <div className="flex items-center gap-3 text-sm">
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
