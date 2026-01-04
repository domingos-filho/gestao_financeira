import { SyncEventType, TransactionType } from "./enums";

export type TransactionPayload = {
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
};

export type SyncEventPayload = {
  eventId: string;
  walletId: string;
  userId: string;
  deviceId: string;
  eventType: SyncEventType;
  payload: unknown;
};
