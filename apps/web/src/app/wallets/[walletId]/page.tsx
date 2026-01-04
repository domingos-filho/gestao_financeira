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

  type Summary = {
    income: number;
    expense: number;
    net: number;
    recent: NonNullable<typeof transactions>;
  };

  const monthSummary = useMemo<Summary>(() => {
    if (!transactions) {
      return { income: 0, expense: 0, net: 0, recent: [] };
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
        <Card className="border-border/60 bg-card/85">
          <CardHeader className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Receitas do mes</p>
            <CardTitle className="text-2xl">{formatBRL(monthSummary.income)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/60 bg-card/85">
          <CardHeader className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Despesas do mes</p>
            <CardTitle className="text-2xl">{formatBRL(monthSummary.expense)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/60 bg-card/85">
          <CardHeader className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Saldo do mes</p>
            <CardTitle className="text-2xl">{formatBRL(monthSummary.net)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/85">
        <CardHeader>
          <CardTitle>Movimentos recentes</CardTitle>
          <CardDescription>Ultimos registros deste mes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {monthSummary.recent.length === 0 && <p className="text-sm text-muted-foreground">Sem transacoes.</p>}
          <div className="divide-y divide-border/70">
            {monthSummary.recent.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{tx.description || "Sem descricao"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(tx.occurredAt).toLocaleDateString()}</p>
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
          </div>
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
