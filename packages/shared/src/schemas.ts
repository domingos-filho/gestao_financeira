import { z } from "zod";
import { SyncEventType, TransactionType } from "./enums";

export const TransactionPayloadSchema = z.object({
  id: z.string().uuid(),
  walletId: z.string().uuid(),
  accountId: z.string().uuid(),
  type: z.nativeEnum(TransactionType),
  amountCents: z.number().int(),
  occurredAt: z.string().datetime(),
  description: z.string().min(1),
  categoryId: z.string().uuid().nullable().optional(),
  counterpartyAccountId: z.string().uuid().nullable().optional(),
  deletedAt: z.string().datetime().nullable().optional()
});

export const SyncEventSchema = z.object({
  eventId: z.string().uuid(),
  walletId: z.string().uuid(),
  userId: z.string().uuid(),
  deviceId: z.string().min(1),
  eventType: z.nativeEnum(SyncEventType),
  payload: z.unknown()
});

export const SyncPushSchema = z.object({
  deviceId: z.string().min(1),
  walletId: z.string().uuid(),
  events: z.array(SyncEventSchema)
});

export const SyncPullResponseSchema = z.object({
  walletId: z.string().uuid(),
  nextSeq: z.number().int(),
  events: z.array(SyncEventSchema.extend({
    serverSeq: z.number().int(),
    serverReceivedAt: z.string().datetime()
  }))
});

export type TransactionPayload = z.infer<typeof TransactionPayloadSchema>;
export type SyncEventDto = z.infer<typeof SyncEventSchema>;
export type SyncPushDto = z.infer<typeof SyncPushSchema>;
export type SyncPullResponseDto = z.infer<typeof SyncPullResponseSchema>;
