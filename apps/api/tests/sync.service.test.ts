import { SyncEventType, TransactionType as PrismaTransactionType } from "@prisma/client";
import { TransactionType } from "@gf/shared";
import { describe, expect, it, vi } from "vitest";
import { SyncService } from "../src/sync/sync.service";

describe("SyncService", () => {
  it("applies a transaction event once even when the event is duplicated", async () => {
    const appliedEventIds = new Set<string>();
    const walletState = { serverSeq: 0 };
    const walletId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const accountId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const transactionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

    const tx = {
      syncEvent: {
        findUnique: vi.fn(async ({ where }: { where: { eventId: string } }) =>
          appliedEventIds.has(where.eventId) ? { eventId: where.eventId } : null
        ),
        create: vi.fn(async ({ data }: { data: { eventId: string } }) => {
          appliedEventIds.add(data.eventId);
          return data;
        })
      },
      wallet: {
        update: vi.fn(async () => {
          walletState.serverSeq += 1;
          return { serverSeq: walletState.serverSeq };
        }),
        findUnique: vi.fn(async () => ({ id: walletId, serverSeq: walletState.serverSeq }))
      },
      account: {
        findFirst: vi.fn(async ({ where }: { where: { id: string; walletId: string } }) => ({
          id: where.id,
          walletId: where.walletId
        }))
      },
      category: {
        findFirst: vi.fn(async () => null)
      },
      recurringExpense: {
        findFirst: vi.fn(async () => null)
      },
      transaction: {
        upsert: vi.fn(async () => ({})),
        findMany: vi.fn()
      },
      walletSnapshot: {
        findFirst: vi.fn(async () => null),
        create: vi.fn()
      }
    };

    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    } as any;
    const service = new SyncService(prisma);
    const eventPayload = {
      id: transactionId,
      walletId,
      accountId,
      type: TransactionType.EXPENSE as PrismaTransactionType,
      amountCents: 1999,
      occurredAt: "2026-06-21T12:00:00.000Z",
      description: "Cafe",
      categoryId: null,
      counterpartyAccountId: null,
      deletedAt: null,
      recurringExpenseId: null,
      recurringMonth: null
    };

    const result = await service.pushEvents({
      userId: "user-1",
      walletId,
      deviceId: "device-1",
      events: [
        {
          eventId: "event-1",
          walletId,
          deviceId: "device-1",
          eventType: SyncEventType.TRANSACTION_CREATED,
          payload: eventPayload
        },
        {
          eventId: "event-1",
          walletId,
          deviceId: "device-1",
          eventType: SyncEventType.TRANSACTION_CREATED,
          payload: eventPayload
        }
      ]
    });

    expect(result).toEqual({
      appliedCount: 1,
      lastSeq: 1
    });
    expect(tx.wallet.update).toHaveBeenCalledTimes(1);
    expect(tx.transaction.upsert).toHaveBeenCalledTimes(1);
    expect(tx.syncEvent.create).toHaveBeenCalledTimes(1);
  });

  it("returns snapshot metadata when the client can resume from a cached snapshot", async () => {
    const prisma = {
      wallet: {
        findUnique: vi.fn().mockResolvedValue({ id: "wallet-1", serverSeq: 7 })
      },
      walletSnapshot: {
        findFirst: vi.fn().mockResolvedValue({
          walletId: "wallet-1",
          lastServerSeq: 5,
          state: { transactions: [] },
          createdAt: new Date("2026-06-20T12:00:00.000Z")
        })
      },
      syncEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            eventId: "event-6",
            walletId: "wallet-1",
            userId: "user-1",
            deviceId: "device-1",
            eventType: SyncEventType.TRANSACTION_CREATED,
            payload: {},
            serverSeq: 6,
            serverReceivedAt: new Date("2026-06-20T12:00:10.000Z")
          },
          {
            eventId: "event-7",
            walletId: "wallet-1",
            userId: "user-1",
            deviceId: "device-1",
            eventType: SyncEventType.TRANSACTION_UPDATED,
            payload: {},
            serverSeq: 7,
            serverReceivedAt: new Date("2026-06-20T12:01:10.000Z")
          }
        ])
      }
    } as any;

    const service = new SyncService(prisma);
    const result = await service.pullEvents("wallet-1", 4, true);

    expect(result.walletId).toBe("wallet-1");
    expect(result.nextSeq).toBe(7);
    expect(result.snapshot).toEqual({
      walletId: "wallet-1",
      lastServerSeq: 5,
      state: { transactions: [] },
      createdAt: "2026-06-20T12:00:00.000Z"
    });
    expect(result.events).toHaveLength(2);
    expect(prisma.syncEvent.findMany).toHaveBeenCalledWith({
      where: {
        walletId: "wallet-1",
        serverSeq: { gt: 5 }
      },
      orderBy: { serverSeq: "asc" }
    });
  });
});
