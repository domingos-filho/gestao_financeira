"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { TransactionType } from "@gf/shared";
import { createLocalTransaction } from "@/lib/sync";
import { getDeviceId } from "@/lib/device";
import { getWalletAccounts } from "@/lib/wallet-cache";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type QuickTransactionFormProps = {
  walletId: string;
};

export function QuickTransactionForm({ walletId }: QuickTransactionFormProps) {
  const { user } = useAuth();
  const accounts = useMemo(() => getWalletAccounts(walletId), [walletId]);
  const categories = useLiveQuery(
    () => db.categories_local.where("walletId").equals(walletId).toArray(),
    [walletId]
  );
  const noneCategoryValue = "__none__";

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [type, setType] = useState<TransactionType>(TransactionType.INCOME);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId && accounts[0]) {
      setAccountId(accounts[0].id);
    }
  }, [accountId, accounts]);

  useEffect(() => {
    if (!categoryId && categories && categories[0]) {
      setCategoryId(categories[0].id);
    }
  }, [categoryId, categories]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!user) return;

    const normalized = Number(amount.replace(",", "."));
    const amountCents = Math.round(normalized * 100);
    if (!amountCents || amountCents <= 0) {
      setError("Informe um valor valido.");
      return;
    }
    if (!description.trim()) {
      setError("Descricao obrigatoria.");
      return;
    }
    if (!accountId) {
      setError("Selecione uma conta.");
      return;
    }

    try {
      await createLocalTransaction({
        walletId,
        accountId,
        type,
        amountCents,
        occurredAt: new Date().toISOString(),
        description,
        categoryId: categoryId ?? null,
        counterpartyAccountId: null,
        userId: user.id,
        deviceId: getDeviceId()
      });

      setDescription("");
      setAmount("");
    } catch {
      setError("Nao foi possivel salvar.");
    }
  };

  if (accounts.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma conta disponivel para esta carteira.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">Tipo</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
              type === TransactionType.INCOME
                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                : "border-border text-muted-foreground"
            }`}
            onClick={() => setType(TransactionType.INCOME)}
          >
            <span className="h-2 w-2 rounded-full border border-emerald-400" />
            Receita
          </button>
          <button
            type="button"
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
              type === TransactionType.EXPENSE
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-border text-muted-foreground"
            }`}
            onClick={() => setType(TransactionType.EXPENSE)}
          >
            <span className="h-2 w-2 rounded-full border border-red-400" />
            Despesa
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Descricao</Label>
        <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex: Mercado" />
      </div>

      <div className="space-y-2">
        <Label>Valor (R$)</Label>
        <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
      </div>

      <div className="space-y-2">
        <Label>Conta</Label>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma conta" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select
          value={categoryId ?? noneCategoryValue}
          onValueChange={(value) => setCategoryId(value === noneCategoryValue ? null : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sem categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={noneCategoryValue}>Sem categoria</SelectItem>
            {(categories ?? []).map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" className="w-full">
        Adicionar
      </Button>
    </form>
  );
}
