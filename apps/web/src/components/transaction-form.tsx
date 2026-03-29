"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { CategoryType, toMonthKey, TransactionType } from "@gf/shared";
import { db, safeDexie } from "@/lib/db";
import {
  createLocalRecurringExpense,
  createLocalRecurringExpenseWithTransaction,
  createLocalTransaction,
  deleteLocalRecurringExpense,
  deleteLocalTransaction,
  updateLocalRecurringExpense,
  updateLocalTransaction
} from "@/lib/sync";
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

function toDayOfMonth(value: string) {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 31) {
    return null;
  }
  return parsed;
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

  const recurringExpense = useLiveQuery(
    () =>
      existing?.recurringExpenseId
        ? safeDexie(() => db.recurring_expenses_local.get(existing.recurringExpenseId ?? ""), undefined)
        : undefined,
    [existing?.recurringExpenseId]
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
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringAmount, setRecurringAmount] = useState("0");
  const [recurringDayOfMonth, setRecurringDayOfMonth] = useState(() => String(new Date().getDate()));
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

  useEffect(() => {
    if (!existing) {
      setIsRecurring(false);
      setRecurringAmount("0");
      setRecurringDayOfMonth(String(new Date().getDate()));
      return;
    }
    if (existing.recurringExpenseId && !recurringExpense) {
      return;
    }

    const currentDay = Number(existing.occurredAt.slice(8, 10)) || new Date().getDate();
    setIsRecurring(Boolean(existing.recurringExpenseId));
    setRecurringAmount(((recurringExpense?.amountCents ?? existing.amountCents) / 100).toFixed(2));
    setRecurringDayOfMonth(String(recurringExpense?.dayOfMonth ?? currentDay));
  }, [existing, recurringExpense]);

  const activeAccountId = resolvedAccountId || accountId;
  const categoryValue = resolvedCategoryId ?? "";
  const isEditing = Boolean(transactionId);
  const recurringMonthLabel = useMemo(() => {
    const targetMonth = existing?.recurringMonth ?? toMonthKey(toIsoDate(occurredAt));
    if (!targetMonth) {
      return null;
    }
    const [year, month] = targetMonth.split("-").map(Number);
    if (!year || !month) {
      return null;
    }
    return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric"
    });
  }, [existing?.recurringMonth, occurredAt]);

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
    const transactionMonth = toMonthKey(occurredAtIso);
    if (!transactionMonth) {
      setError("Nao foi possivel identificar o mes da transacao.");
      return;
    }

    const recurringEnabled = type === TransactionType.EXPENSE && isRecurring;
    let recurringAmountCents = 0;
    let recurringDay = 1;

    if (recurringEnabled) {
      recurringAmountCents = Math.round(Number(recurringAmount.replace(",", ".")) * 100);
      recurringDay = toDayOfMonth(recurringDayOfMonth) ?? 0;
      if (!recurringAmountCents || recurringAmountCents <= 0) {
        setError("Informe um valor base valido para a recorrencia.");
        return;
      }
      if (!recurringDay) {
        setError("Informe um dia valido entre 1 e 31.");
        return;
      }
      if (existing?.recurringMonth && existing.recurringMonth !== transactionMonth) {
        setError("Lancamentos recorrentes podem mudar o dia, mas devem continuar no mesmo mes da ocorrencia.");
        return;
      }
    }

    let nextRecurringExpenseId = recurringEnabled ? recurringExpense?.id ?? null : null;

    if (transactionId && existing) {
      if (recurringEnabled) {
        if (recurringExpense) {
          await updateLocalRecurringExpense({
            id: recurringExpense.id,
            walletId,
            accountId: activeAccountId,
            description,
            amountCents: recurringAmountCents,
            categoryId: resolvedCategoryId ?? null,
            dayOfMonth: recurringDay,
            startMonth: recurringExpense.startMonth,
            archivedAt: null,
            userId: user.id,
            deviceId
          });
          nextRecurringExpenseId = recurringExpense.id;
        } else {
          nextRecurringExpenseId = await createLocalRecurringExpense({
            walletId,
            accountId: activeAccountId,
            description,
            amountCents: recurringAmountCents,
            categoryId: resolvedCategoryId ?? null,
            dayOfMonth: recurringDay,
            startMonth: transactionMonth,
            archivedAt: null,
            userId: user.id,
            deviceId
          });
        }
      } else if (recurringExpense) {
        await deleteLocalRecurringExpense({
          id: recurringExpense.id,
          walletId,
          accountId: recurringExpense.accountId,
          description: recurringExpense.description,
          amountCents: recurringExpense.amountCents,
          categoryId: recurringExpense.categoryId ?? null,
          dayOfMonth: recurringExpense.dayOfMonth,
          startMonth: recurringExpense.startMonth,
          archivedAt: new Date().toISOString(),
          userId: user.id,
          deviceId
        });
      }

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
        recurringExpenseId: recurringEnabled ? nextRecurringExpenseId : null,
        recurringMonth: recurringEnabled ? transactionMonth : null,
        userId: user.id,
        deviceId
      });
    } else if (recurringEnabled) {
      await createLocalRecurringExpenseWithTransaction({
        walletId,
        accountId: activeAccountId,
        description,
        amountCents,
        categoryId: resolvedCategoryId ?? null,
        occurredAt: occurredAtIso,
        dayOfMonth: recurringDay,
        startMonth: transactionMonth,
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
        recurringExpenseId: null,
        recurringMonth: null,
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
      recurringExpenseId: existing.recurringExpenseId ?? null,
      recurringMonth: existing.recurringMonth ?? null,
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
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <div className="relative">
            <select
              className="flex h-10 w-full appearance-none items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={type}
              onChange={(event) => {
                const value = event.target.value as TransactionType;
                if (
                  value === TransactionType.EXPENSE ||
                  value === TransactionType.INCOME ||
                  value === TransactionType.TRANSFER
                ) {
                  setType(value);
                  if (value !== TransactionType.EXPENSE) {
                    setIsRecurring(false);
                  }
                }
              }}
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
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

      {type === TransactionType.EXPENSE && (
        <div className="space-y-4 rounded-2xl border border-border/80 bg-muted/40 p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border"
              checked={isRecurring}
              onChange={(event) => {
                const checked = event.target.checked;
                setIsRecurring(checked);
                if (checked) {
                  setRecurringAmount((current) =>
                    current && current !== "0" && current !== "0.00" ? current : amount
                  );
                  setRecurringDayOfMonth((current) =>
                    current && current !== "0"
                      ? current
                      : String(Number(occurredAt.slice(8, 10)) || new Date().getDate())
                  );
                }
              }}
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-foreground">Despesa recorrente mensal</span>
              <span className="block text-xs text-muted-foreground">
                O valor principal desta transacao representa a cobranca real do mes. A configuracao abaixo define os
                proximos meses.
              </span>
            </span>
          </label>

          {isRecurring && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Valor base para os proximos meses</Label>
                <Input
                  value={recurringAmount}
                  onChange={(event) => setRecurringAmount(event.target.value)}
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label>Dia previsto no mes</Label>
                <Input
                  value={recurringDayOfMonth}
                  onChange={(event) => setRecurringDayOfMonth(event.target.value)}
                  inputMode="numeric"
                  placeholder="Ex: 10"
                />
              </div>
            </div>
          )}

          {isRecurring && recurringMonthLabel && (
            <p className="text-xs text-muted-foreground">
              Ocorrencia vinculada a {recurringMonthLabel}. Alteracoes nesta secao atualizam a previsao dos meses
              seguintes.
            </p>
          )}
        </div>
      )}

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
