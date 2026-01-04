import { SyncEventType } from "./enums";

export type SyncEventPayload = {
  eventId: string;
  walletId: string;
  userId: string;
  deviceId: string;
  eventType: SyncEventType;
  payload: unknown;
};
