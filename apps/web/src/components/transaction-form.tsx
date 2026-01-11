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
import { getCategoryIcon } from "@/lib/category-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const noneCategoryValue = "__none__";

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

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [amount, setAmount] = useState("0");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [description, setDescription] = useState("");
  const [counterpartyAccountId, setCounterpartyAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleCategories = useMemo(() => {
    if (type === TransactionType.TRANSFER) {
      return [];
    }
    const targetType = type === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
    return (categories ?? []).filter((category) => !category.archivedAt && category.type === targetType);
  }, [categories, type]);

  const selectedCategory = useMemo(() => {
    if (!categoryId) return null;
    return (categories ?? []).find((category) => category.id === categoryId) ?? null;
  }, [categories, categoryId]);

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

  useEffect(() => {
    if (!accountId && accounts.length > 0 && accounts[0]) {
      setAccountId(accounts[0].id);
    }
  }, [accountId, accounts]);

  useEffect(() => {
    if (type === TransactionType.TRANSFER) {
      setCategoryId(null);
      return;
    }
    const targetType = type === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
    if (selectedCategory?.archivedAt && selectedCategory.type === targetType) {
      return;
    }
    if (visibleCategories.length === 0) {
      setCategoryId(null);
      return;
    }
    if (!categoryId || !visibleCategories.some((category) => category.id === categoryId)) {
      setCategoryId(visibleCategories[0].id);
    }
  }, [categoryId, type, visibleCategories, selectedCategory]);

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
        accountId,
        type,
        amountCents,
        occurredAt: occurredAtIso,
        description,
        categoryId: categoryId ?? null,
        counterpartyAccountId: type === TransactionType.TRANSFER ? counterpartyAccountId : null,
        userId: user.id,
        deviceId
      });
    } else {
      await createLocalTransaction({
        walletId,
        accountId,
        type,
        amountCents,
        occurredAt: occurredAtIso,
        description,
        categoryId: categoryId ?? null,
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

  if (accounts.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma conta disponivel para esta carteira.</p>;
  }

  const transferTargets = accounts.filter((account) => account.id !== accountId);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Conta</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
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
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(value) => setType(value as TransactionType)}>
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
            value={counterpartyAccountId ?? ""}
            onValueChange={(value) => setCounterpartyAccountId(value || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
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
        <Select
          value={categoryId ?? noneCategoryValue}
          onValueChange={(value) => setCategoryId(value === noneCategoryValue ? null : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sem categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={noneCategoryValue}>Sem categoria</SelectItem>
            {selectedCategory && selectedCategory.archivedAt && (
              <SelectItem value={selectedCategory.id} disabled>
                {selectedCategory.name} (arquivada)
              </SelectItem>
            )}
            {visibleCategories.map((category) => {
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

      <div className="flex flex-wrap gap-3">
        <Button type="submit">Salvar</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        {existing && (
          <Button type="button" variant="ghost" onClick={handleDelete}>
            Excluir
          </Button>
        )}
      </div>
    </form>
  );
}
