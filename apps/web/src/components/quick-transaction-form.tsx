"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CategoryType, TransactionType } from "@gf/shared";
import { createLocalTransaction } from "@/lib/sync";
import { getDeviceId } from "@/lib/device";
import { useWalletAccounts } from "@/lib/wallets";
import { useAuth } from "@/lib/auth";
import { db, safeDexie } from "@/lib/db";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type QuickTransactionFormProps = {
  walletId: string;
};

export function QuickTransactionForm({ walletId }: QuickTransactionFormProps) {
  const { user } = useAuth();
  const { accounts, isLoading: accountsLoading } = useWalletAccounts(walletId);
  const categories = useLiveQuery(
    () => safeDexie(() => db.categories_local.where("walletId").equals(walletId).toArray(), []),
    [walletId]
  );

  const validAccounts = useMemo(
    () => accounts.filter((account) => account && account.id && account.name),
    [accounts]
  );
  const accountId = validAccounts[0]?.id ?? "";
  const [type, setType] = useState<TransactionType>(TransactionType.INCOME);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedCategories = useMemo(() => {
    const safeCategories = (categories ?? []).filter((category) => category && category.id && category.name);
    return safeCategories.map((category) => ({
      ...category,
      type: category.type ?? CategoryType.EXPENSE,
      color: category.color ?? "#4fa2ff",
      icon: category.icon ?? "tag",
      archivedAt: category.archivedAt ?? null
    }));
  }, [categories]);

  const availableCategories = useMemo(() => {
    const list = normalizedCategories;
    const targetType = type === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
    return list.filter((category) => !category.archivedAt && category.type === targetType);
  }, [normalizedCategories, type]);

  const resolvedCategoryId = useMemo(() => {
    const firstCategory = availableCategories[0];
    if (!firstCategory) {
      return null;
    }
    if (!categoryId || !availableCategories.some((category) => category.id === categoryId)) {
      return firstCategory.id;
    }
    return categoryId;
  }, [availableCategories, categoryId]);

  const categoryValue = resolvedCategoryId ?? "";

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
      setError("Nenhuma conta disponivel.");
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
        categoryId: resolvedCategoryId ?? null,
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

  if (accountsLoading) {
    return <p className="text-sm text-muted-foreground">Carregando contas...</p>;
  }

  if (validAccounts.length === 0) {
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
                ? "border-[rgba(17,204,149,0.35)] bg-[var(--color-success-soft)] text-[var(--color-success)]"
                : "border-border text-muted-foreground"
            }`}
            onClick={() => setType(TransactionType.INCOME)}
          >
            <span className="h-2 w-2 rounded-full border border-[rgba(17,204,149,0.7)]" />
            Receita
          </button>
          <button
            type="button"
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
              type === TransactionType.EXPENSE
                ? "border-[rgba(233,104,120,0.35)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                : "border-border text-muted-foreground"
            }`}
            onClick={() => setType(TransactionType.EXPENSE)}
          >
            <span className="h-2 w-2 rounded-full border border-[rgba(233,104,120,0.7)]" />
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
        <Label>Categoria</Label>
        <div className="relative">
          <select
            className="flex h-10 w-full appearance-none items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={categoryValue}
            onChange={(event) => setCategoryId(event.target.value || null)}
          >
            <option value="">Sem categoria</option>
            {availableCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <Button type="submit" className="w-full">
        Adicionar
      </Button>
    </form>
  );
}
