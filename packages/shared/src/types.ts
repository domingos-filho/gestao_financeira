import type { RecurringExpensePayload, TransactionPayload } from "./schemas";
import { SyncEventType } from "./enums";

export type SyncEntityPayload = TransactionPayload | RecurringExpensePayload;

export type SyncEventPayload = {
  eventId: string;
  walletId: string;
  userId: string;
  deviceId: string;
  eventType: SyncEventType;
  payload: SyncEntityPayload;
};
