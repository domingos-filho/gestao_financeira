"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { TransactionType } from "@gf/shared";
import { ArrowDownRight, ArrowUpRight, Repeat } from "lucide-react";
import { db } from "@/lib/db";
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
      db.transactions_local
        .where("walletId")
        .equals(walletId)
        .and((tx) => !tx.deletedAt)
        .toArray(),
    [walletId]
  );

  const sorted = (transactions ?? []).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return (
    <div className="grid gap-6 animate-rise">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Todas as Transacoes</h2>
          <p className="text-sm text-muted-foreground">Historico completo de receitas e despesas</p>
        </div>
        <Button asChild>
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
                      ? "bg-red-50 text-red-600"
                      : tx.type === TransactionType.TRANSFER
                      ? "bg-blue-50 text-blue-600"
                      : "bg-emerald-50 text-emerald-600"
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
                  <p className="text-xs text-muted-foreground">{new Date(tx.occurredAt).toLocaleDateString()}</p>
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
                      ? "text-red-600"
                      : tx.type === TransactionType.TRANSFER
                      ? "text-blue-600"
                      : "text-emerald-600"
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
