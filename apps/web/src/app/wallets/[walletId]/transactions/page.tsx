"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { TransactionType } from "@gf/shared";
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
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Transacoes</h2>
        <Button asChild>
          <Link href={`/wallets/${walletId}/transactions/new`}>Nova transacao</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista completa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.length === 0 && <p className="text-sm text-gray-600">Sem transacoes locais.</p>}
          {sorted.map((tx) => (
            <Link
              key={tx.id}
              href={`/wallets/${walletId}/transactions/${tx.id}/edit`}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 hover:shadow-sm"
            >
              <div>
                <p className="font-medium">{tx.description || "Sem descricao"}</p>
                <p className="text-xs text-gray-500">{new Date(tx.occurredAt).toLocaleDateString()}</p>
              </div>
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
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
