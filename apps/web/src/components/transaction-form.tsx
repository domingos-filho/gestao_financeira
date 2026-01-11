"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { CategoryType, TransactionType } from "@gf/shared";
import { db, safeDexie } from "@/lib/db";
import { createLocalTransaction, deleteLocalTransaction, updateLocalTransaction } from "@/lib/sync";
import { getDeviceId } from "@/lib/device";
import { useWalletAccounts } from "@/lib/wallets";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const typeOptions = [
  { value: TransactionType.EXPENSE, label: "Despesa" },
  { value: TransactionType.INCOME, label: "Receita" },
  { value: TransactionType.TRANSFER, label: "Transferencia" }
];

function toIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return new Date().toISOString();
  }
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
}

export function TransactionForm({ walletId, transactionId }: { walletId: string; transactionId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const noneAccountValue = "__none_account__";

  const existing = useLiveQuery(
    () =>
      transactionId ? safeDexie(() => db.transactions_local.get(transactionId), undefined) : undefined,
    [transactionId]
  );

  const categories = useLiveQuery(
    () => safeDexie(() => db.categories_local.where("walletId").equals(walletId).toArray(), []),
    [walletId]
  );

  const { accounts, isLoading: accountsLoading } = useWalletAccounts(walletId);

  const safeAccounts = useMemo(
    () => accounts.filter((account) => account && account.id && account.name),
    [accounts]
  );

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [amount, setAmount] = useState("0");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [description, setDescription] = useState("");
  const [counterpartyAccountId, setCounterpartyAccountId] = useState<string | null>(null);
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

  const visibleCategories = useMemo(() => {
    if (type === TransactionType.TRANSFER) {
      return [];
    }
    const targetType = type === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
    return normalizedCategories.filter((category) => !category.archivedAt && category.type === targetType);
  }, [normalizedCategories, type]);

  const rawSelectedCategory = useMemo(() => {
    if (!categoryId) return null;
    return normalizedCategories.find((category) => category.id === categoryId) ?? null;
  }, [normalizedCategories, categoryId]);

  const resolvedAccountId = useMemo(() => {
    if (safeAccounts.length === 0) {
      return "";
    }
    if (safeAccounts.some((account) => account.id === accountId)) {
      return accountId;
    }
    return safeAccounts[0]?.id ?? "";
  }, [accountId, safeAccounts]);

  const resolvedCategoryId = useMemo(() => {
    if (type === TransactionType.TRANSFER) {
      return null;
    }
    const firstCategory = visibleCategories[0];
    const targetType = type === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
    if (categoryId && rawSelectedCategory?.archivedAt && rawSelectedCategory.type === targetType) {
      return categoryId;
    }
    if (!firstCategory) {
      return null;
    }
    if (!categoryId || !visibleCategories.some((category) => category.id === categoryId)) {
      return firstCategory.id;
    }
    return categoryId;
  }, [categoryId, rawSelectedCategory, type, visibleCategories]);

  const selectedCategory = useMemo(() => {
    if (!resolvedCategoryId) return null;
    return normalizedCategories.find((category) => category.id === resolvedCategoryId) ?? null;
  }, [normalizedCategories, resolvedCategoryId]);

  useEffect(() => {
    if (!existing) return;
    setAccountId(existing.accountId);
    setType(existing.type);
    setAmount((existing.amountCents / 100).toFixed(2));
    setOccurredAt(existing.occurredAt.slice(0, 10));
    setDescription(existing.description);
    setCounterpartyAccountId(existing.counterpartyAccountId ?? null);
    setCategoryId(existing.categoryId ?? null);
  }, [existing]);

  const activeAccountId = resolvedAccountId || accountId;
  const categoryValue = resolvedCategoryId ?? "";
  const isEditing = Boolean(transactionId);

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
    if (type === TransactionType.TRANSFER && !counterpartyAccountId) {
      setError("Selecione a conta destino.");
      return;
    }
    const deviceId = getDeviceId();
    const occurredAtIso = toIsoDate(occurredAt);

    if (transactionId && existing) {
      await updateLocalTransaction({
        id: existing.id,
        walletId,
        accountId: activeAccountId,
        type,
        amountCents,
        occurredAt: occurredAtIso,
        description,
        categoryId: resolvedCategoryId ?? null,
        counterpartyAccountId: type === TransactionType.TRANSFER ? counterpartyAccountId : null,
        userId: user.id,
        deviceId
      });
    } else {
      await createLocalTransaction({
        walletId,
        accountId: activeAccountId,
        type,
        amountCents,
        occurredAt: occurredAtIso,
        description,
        categoryId: resolvedCategoryId ?? null,
        counterpartyAccountId: type === TransactionType.TRANSFER ? counterpartyAccountId : null,
        userId: user.id,
        deviceId
      });
    }

    router.push(`/wallets/${walletId}/transactions`);
  };

  const handleDelete = async () => {
    if (!existing || !user) return;
    await deleteLocalTransaction({
      id: existing.id,
      walletId: existing.walletId,
      accountId: existing.accountId,
      type: existing.type,
      amountCents: existing.amountCents,
      occurredAt: existing.occurredAt,
      description: existing.description,
      categoryId: existing.categoryId ?? null,
      counterpartyAccountId: existing.counterpartyAccountId ?? null,
      userId: user.id,
      deviceId: getDeviceId()
    });
    router.push(`/wallets/${walletId}/transactions`);
  };

  if (accountsLoading) {
    return <p className="text-sm text-muted-foreground">Carregando contas...</p>;
  }

  if (safeAccounts.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma conta disponivel para esta carteira.</p>;
  }

  const transferTargets = safeAccounts.filter((account) => account.id !== activeAccountId);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Conta</Label>
          <Select value={activeAccountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {safeAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select
            value={type}
            onValueChange={(value) => {
              if (
                value === TransactionType.EXPENSE ||
                value === TransactionType.INCOME ||
                value === TransactionType.TRANSFER
              ) {
                setType(value);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Valor (BRL)</Label>
          <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
        </div>
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
        </div>
      </div>

      {type === TransactionType.TRANSFER && (
        <div className="space-y-2">
          <Label>Conta destino</Label>
          <Select
            value={counterpartyAccountId ?? noneAccountValue}
            onValueChange={(value) =>
              setCounterpartyAccountId(value === noneAccountValue ? null : value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={noneAccountValue}>Selecione</SelectItem>
              {transferTargets.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {transferTargets.length === 0 && (
            <p className="text-xs text-muted-foreground">Crie outra conta para permitir transferencias.</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>Descricao</Label>
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label>Categoria</Label>
        <div className="relative">
          <select
            className="flex h-10 w-full appearance-none items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
            value={categoryValue}
            onChange={(event) => setCategoryId(event.target.value || null)}
            disabled={type === TransactionType.TRANSFER}
          >
            <option value="">Sem categoria</option>
            {selectedCategory && selectedCategory.archivedAt && (
              <option value={selectedCategory.id} disabled>
                {selectedCategory.name} (arquivada)
              </option>
            )}
            {visibleCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant={isEditing ? "edit" : "create"}>
          Salvar
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        {existing && (
          <Button type="button" variant="delete" onClick={handleDelete}>
            Excluir
          </Button>
        )}
      </div>
    </form>
  );
}
