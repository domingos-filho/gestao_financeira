"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { TransactionType } from "@gf/shared";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function formatBRL(amountCents: number) {
  return (amountCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

export default function WalletDashboard({ params }: { params: { walletId: string } }) {
  const { walletId } = params;

  const transactions = useLiveQuery(
    () => db.transactions_local.where("walletId").equals(walletId).and((tx) => !tx.deletedAt).toArray(),
    [walletId]
  );

  const monthSummary = useMemo(() => {
    if (!transactions) {
      return { income: 0, expense: 0, net: 0, recent: [] as typeof transactions };
    }

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    let income = 0;
    let expense = 0;
    const filtered = transactions.filter((tx) => {
      const occurred = new Date(tx.occurredAt);
      return occurred >= start && occurred < end;
    });

    for (const tx of filtered) {
      if (tx.type === TransactionType.INCOME) income += tx.amountCents;
      if (tx.type === TransactionType.EXPENSE) expense += tx.amountCents;
    }

    const recent = [...filtered].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 5);

    return {
      income,
      expense,
      net: income - expense,
      recent
    };
  }, [transactions]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Receitas do mes</CardDescription>
            <CardTitle>{formatBRL(monthSummary.income)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Despesas do mes</CardDescription>
            <CardTitle>{formatBRL(monthSummary.expense)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Saldo do mes</CardDescription>
            <CardTitle>{formatBRL(monthSummary.net)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimentos recentes</CardTitle>
          <CardDescription>Ultimos registros deste mes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {monthSummary.recent.length === 0 && <p className="text-sm text-gray-600">Sem transacoes.</p>}
          {monthSummary.recent.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between">
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
            </div>
          ))}
        </CardContent>
      </Card>

      <div>
        <Button asChild>
          <Link href={`/wallets/${walletId}/transactions`}>Ver todas as transacoes</Link>
        </Button>
      </div>
    </div>
  );
}
