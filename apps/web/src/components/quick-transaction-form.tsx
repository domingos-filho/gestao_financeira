"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CategoryType, TransactionType } from "@gf/shared";
import { createLocalTransaction } from "@/lib/sync";
import { getDeviceId } from "@/lib/device";
import { useWalletAccounts } from "@/lib/wallets";
import { useAuth } from "@/lib/auth";
import { db, safeDexie } from "@/lib/db";
import { getCategoryIcon } from "@/lib/category-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const noneCategoryValue = "__none__";

  const accountId = accounts[0]?.id ?? "";
  const [type, setType] = useState<TransactionType>(TransactionType.INCOME);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedCategories = useMemo(() => {
    return (categories ?? []).map((category) => ({
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

  useEffect(() => {
    const firstCategory = availableCategories[0];
    if (!firstCategory) {
      setCategoryId(null);
      return;
    }
    if (!categoryId || !availableCategories.some((category) => category.id === categoryId)) {
      setCategoryId(firstCategory.id);
    }
  }, [availableCategories, categoryId]);

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

  if (accountsLoading) {
    return <p className="text-sm text-muted-foreground">Carregando contas...</p>;
  }

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
        <Select
          value={categoryId ?? noneCategoryValue}
          onValueChange={(value) => setCategoryId(value === noneCategoryValue ? null : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sem categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={noneCategoryValue}>Sem categoria</SelectItem>
            {availableCategories.map((category) => {
              const Icon = getCategoryIcon(category.icon);
              const displayColor = category.color ?? "#4fa2ff";
              return (
                <SelectItem key={category.id} value={category.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${displayColor}1A`, color: displayColor }}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    {category.name}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <Button type="submit" className="w-full">
        Adicionar
      </Button>
    </form>
  );
}
