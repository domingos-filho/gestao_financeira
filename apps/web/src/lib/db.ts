import Dexie, { Table } from "dexie";
import { CategoryType, SyncEventType, TransactionPayload, TransactionType } from "@gf/shared";

export type TransactionLocal = {
  id: string;
  walletId: string;
  accountId: string;
  type: TransactionType;
  amountCents: number;
  occurredAt: string;
  description: string;
  categoryId?: string | null;
  counterpartyAccountId?: string | null;
  deletedAt?: string | null;
  updatedAt: string;
};

export type CategoryLocal = {
  id: string;
  walletId: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  sortOrder: number;
  archivedAt?: string | null;
  updatedAt: string;
};

export type DebtStatus = "ACTIVE" | "PAID" | "CANCELED";

export type DebtLocal = {
  id: string;
  walletId: string;
  name: string;
  principalCents: number;
  interestRate: number | null;
  monthlyPaymentCents: number | null;
  startedAt: string;
  dueAt?: string | null;
  status: DebtStatus;
  updatedAt: string;
};

export type SyncEventStatus = "PENDING" | "ACKED";

export type SyncEventLocal = {
  eventId: string;
  walletId: string;
  userId: string;
  deviceId: string;
  eventType: SyncEventType;
  payload: TransactionPayload;
  status: SyncEventStatus;
  createdAt: string;
};

export type SyncMetadata = {
  key: string;
  value: string;
};

class FinanceDB extends Dexie {
  transactions_local!: Table<TransactionLocal, string>;
  categories_local!: Table<CategoryLocal, string>;
  debts_local!: Table<DebtLocal, string>;
  sync_events_local!: Table<SyncEventLocal, string>;
  sync_metadata!: Table<SyncMetadata, string>;

  constructor() {
    super("gestao_financeira");
    this.version(1).stores({
      transactions_local: "id, walletId, occurredAt, deletedAt",
      sync_events_local: "eventId, walletId, status, createdAt",
      sync_metadata: "key"
    });
    this.version(2).stores({
      transactions_local: "id, walletId, occurredAt, deletedAt",
      categories_local: "id, walletId, updatedAt",
      debts_local: "id, walletId, status, startedAt",
      sync_events_local: "eventId, walletId, status, createdAt",
      sync_metadata: "key"
    });
    this.version(3).stores({
      transactions_local: "id, walletId, occurredAt, deletedAt",
      categories_local: "id, walletId, type, archivedAt, sortOrder, updatedAt",
      debts_local: "id, walletId, status, startedAt",
      sync_events_local: "eventId, walletId, status, createdAt",
      sync_metadata: "key"
    });
  }
}

export const db = new FinanceDB();

export async function safeDexie<T>(work: () => Promise<T>, fallback: T) {
  try {
    return await work();
  } catch (error) {
    console.error("Dexie error", error);
    return fallback;
  }
}

export async function getMetadata(key: string) {
  const entry = await db.sync_metadata.get(key);
  return entry?.value ?? null;
}

export async function setMetadata(key: string, value: string) {
  await db.sync_metadata.put({ key, value });
}
