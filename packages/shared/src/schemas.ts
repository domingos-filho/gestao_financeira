import { z } from "zod";
import { SyncEventType, TransactionType } from "./enums";
import { monthKeyRegex } from "./recurring";

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
  deletedAt: z.string().datetime().nullable().optional(),
  recurringExpenseId: z.string().uuid().nullable().optional(),
  recurringMonth: z.string().regex(monthKeyRegex).nullable().optional()
}).superRefine((value, ctx) => {
  const hasRecurringExpenseId = Boolean(value.recurringExpenseId);
  const hasRecurringMonth = Boolean(value.recurringMonth);
  if (hasRecurringExpenseId !== hasRecurringMonth) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Recurring transaction metadata is incomplete"
    });
  }
  if (hasRecurringExpenseId && value.type !== TransactionType.EXPENSE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Recurring transactions must be expenses"
    });
  }
});

export const RecurringExpensePayloadSchema = z.object({
  id: z.string().uuid(),
  walletId: z.string().uuid(),
  accountId: z.string().uuid(),
  description: z.string().min(1),
  amountCents: z.number().int().positive(),
  categoryId: z.string().uuid().nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31),
  startMonth: z.string().regex(monthKeyRegex),
  archivedAt: z.string().datetime().nullable().optional()
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
  })),
  snapshot: z
    .object({
      walletId: z.string().uuid(),
      lastServerSeq: z.number().int(),
      state: z.unknown(),
      createdAt: z.string().datetime()
    })
    .nullable()
    .optional()
});

export type TransactionPayload = z.infer<typeof TransactionPayloadSchema>;
export type RecurringExpensePayload = z.infer<typeof RecurringExpensePayloadSchema>;
export type SyncEventDto = z.infer<typeof SyncEventSchema>;
export type SyncPushDto = z.infer<typeof SyncPushSchema>;
export type SyncPullResponseDto = z.infer<typeof SyncPullResponseSchema>;
