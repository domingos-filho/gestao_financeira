"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { TransactionType } from "@gf/shared";
import { db } from "@/lib/db";
import { createLocalTransaction, deleteLocalTransaction, updateLocalTransaction } from "@/lib/sync";
import { getDeviceId } from "@/lib/device";
import { getWalletAccounts } from "@/lib/wallet-cache";
import { useAuth } from "@/lib/auth";
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

  const existing = useLiveQuery(
    () => (transactionId ? db.transactions_local.get(transactionId) : undefined),
    [transactionId]
  );

  const accounts = useMemo(() => getWalletAccounts(walletId), [walletId]);

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [amount, setAmount] = useState("0");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [description, setDescription] = useState("");
  const [counterpartyAccountId, setCounterpartyAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setAccountId(existing.accountId);
    setType(existing.type);
    setAmount((existing.amountCents / 100).toFixed(2));
    setOccurredAt(existing.occurredAt.slice(0, 10));
    setDescription(existing.description);
    setCounterpartyAccountId(existing.counterpartyAccountId ?? null);
  }, [existing]);

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accountId, accounts]);

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
      counterpartyAccountId: existing.counterpartyAccountId ?? null,
      userId: user.id,
      deviceId: getDeviceId()
    });
    router.push(`/wallets/${walletId}/transactions`);
  };

  if (accounts.length === 0) {
    return <p className="text-sm text-gray-600">Nenhuma conta disponivel para esta carteira.</p>;
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
            <p className="text-xs text-gray-500">Crie outra conta para permitir transferencias.</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>Descricao</Label>
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} required />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

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
