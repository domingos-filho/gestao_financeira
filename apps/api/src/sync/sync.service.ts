import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, SyncEventType, TransactionType as PrismaTransactionType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TransactionPayload, TransactionPayloadSchema, TransactionType as SharedTransactionType } from "@gf/shared";

const DEFAULT_SNAPSHOT_EVENT_INTERVAL = 200;
const DEFAULT_SNAPSHOT_MAX_AGE_HOURS = 24;
const DEFAULT_COMPACTION_KEEP_SEQ = 50;

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  async pushEvents(params: {
    userId: string;
    walletId: string;
    deviceId: string;
    events: { eventId: string; walletId: string; deviceId: string; eventType: SyncEventType; payload: unknown }[];
  }) {
    const { userId, walletId, deviceId, events } = params;

    return this.prisma.$transaction(async (tx) => {
      const applied: { eventId: string; serverSeq: number }[] = [];

      for (const event of events) {
        try {
          if (event.walletId !== walletId) {
            throw new BadRequestException("walletId mismatch");
          }
          if (event.deviceId !== deviceId) {
            throw new BadRequestException("deviceId mismatch");
          }

          const existing = await tx.syncEvent.findUnique({ where: { eventId: event.eventId } });
          if (existing) {
            continue;
          }

          const serverSeq = await this.nextWalletSeq(tx, walletId);
          const payload = this.normalizePayload(event.payload);

          try {
            await tx.syncEvent.create({
              data: {
                eventId: event.eventId,
                walletId,
                userId,
                deviceId,
                eventType: event.eventType,
                payload,
                serverSeq
              }
            });
          } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
              continue;
            }
            if (error instanceof Prisma.PrismaClientValidationError) {
              throw new BadRequestException("Invalid sync payload");
            }
            throw error;
          }

          await this.applyEvent(tx, walletId, event.eventType, payload);

          applied.push({ eventId: event.eventId, serverSeq });
        } catch (error) {
          console.error("Sync push failed", {
            eventId: event.eventId,
            eventType: event.eventType,
            error: error instanceof Error ? error.message : String(error)
          });
          throw this.buildSyncError(error, event);
        }
      }

      const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
      const currentSeq = wallet?.serverSeq ?? 0;

      try {
        await this.maybeCreateSnapshot(tx, walletId, currentSeq);
      } catch (error) {
        console.error("Snapshot generation failed", {
          walletId,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      return {
        appliedCount: applied.length,
        lastSeq: currentSeq
      };
    });
  }

  async pullEvents(walletId: string, sinceSeq: number, useSnapshot = false) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) {
      throw new BadRequestException("Wallet not found");
    }

    let snapshotPayload: {
      walletId: string;
      lastServerSeq: number;
      state: Prisma.JsonValue;
      createdAt: string;
    } | null = null;
    let effectiveSinceSeq = sinceSeq;

    if (useSnapshot) {
      const snapshot = await this.prisma.walletSnapshot.findFirst({
        where: { walletId },
        orderBy: { createdAt: "desc" }
      });

      if (snapshot && sinceSeq <= snapshot.lastServerSeq) {
        snapshotPayload = {
          walletId,
          lastServerSeq: snapshot.lastServerSeq,
          state: snapshot.state,
          createdAt: snapshot.createdAt.toISOString()
        };
        effectiveSinceSeq = snapshot.lastServerSeq;
      }
    }

    const events = await this.prisma.syncEvent.findMany({
      where: {
        walletId,
        serverSeq: { gt: effectiveSinceSeq }
      },
      orderBy: { serverSeq: "asc" }
    });

    return {
      walletId,
      nextSeq: wallet.serverSeq,
      events: events.map((event) => ({
        eventId: event.eventId,
        walletId: event.walletId,
        userId: event.userId,
        deviceId: event.deviceId,
        eventType: event.eventType,
        payload: event.payload,
        serverSeq: event.serverSeq,
        serverReceivedAt: event.serverReceivedAt.toISOString()
      })),
      snapshot: snapshotPayload
    };
  }

  private async nextWalletSeq(tx: Prisma.TransactionClient, walletId: string) {
    try {
      const wallet = await tx.wallet.update({
        where: { id: walletId },
        data: { serverSeq: { increment: 1 } },
        select: { serverSeq: true }
      });
      return wallet.serverSeq;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new BadRequestException("Wallet not found");
      }
      throw error;
    }
  }

  private async applyEvent(
    tx: Prisma.TransactionClient,
    walletId: string,
    eventType: SyncEventType,
    payload: unknown
  ) {
    if (
      eventType !== SyncEventType.TRANSACTION_CREATED &&
      eventType !== SyncEventType.TRANSACTION_UPDATED &&
      eventType !== SyncEventType.TRANSACTION_DELETED
    ) {
      throw new BadRequestException("Unsupported event type");
    }

    let transaction = this.normalizeTransactionPayload(payload, walletId);
    let parsed = TransactionPayloadSchema.safeParse(transaction);
    if (!parsed.success) {
      const fallbackAccount = await this.getFallbackAccountId(tx, walletId);
      if (fallbackAccount) {
        transaction.accountId = fallbackAccount;
      }
      parsed = TransactionPayloadSchema.safeParse(transaction);
    }
    if (!parsed.success) {
      throw new BadRequestException("Invalid transaction payload");
    }
    transaction = parsed.data;

    if (transaction.amountCents <= 0) {
      throw new BadRequestException("amount_cents must be positive");
    }

    if (transaction.type === SharedTransactionType.TRANSFER) {
      if (!transaction.counterpartyAccountId) {
        throw new BadRequestException("counterparty_account_id required for transfer");
      }
      if (transaction.counterpartyAccountId === transaction.accountId) {
        throw new BadRequestException("counterparty_account_id must be different");
      }
    } else if (transaction.counterpartyAccountId) {
      throw new BadRequestException("counterparty_account_id only for transfer");
    }

    const account = await tx.account.findFirst({
      where: { id: transaction.accountId, walletId }
    });
    if (!account) {
      const fallback = await this.getFallbackAccountId(tx, walletId);
      if (!fallback) {
        throw new BadRequestException("Invalid account_id");
      }
      transaction.accountId = fallback;
    }

    if (transaction.categoryId) {
      const category = await tx.category.findFirst({
        where: { id: transaction.categoryId, walletId }
      });
      if (!category) {
        transaction.categoryId = null;
      }
    }

    if (transaction.counterpartyAccountId) {
      const counterparty = await tx.account.findFirst({
        where: { id: transaction.counterpartyAccountId, walletId }
      });
      if (!counterparty) {
        throw new BadRequestException("Invalid counterparty_account_id");
      }
    }

    const occurredAt = new Date(transaction.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException("Invalid occurred_at");
    }
    const deletedAt = transaction.deletedAt ? new Date(transaction.deletedAt) : null;

    if (eventType === SyncEventType.TRANSACTION_DELETED) {
      const deleteTimestamp = deletedAt ?? new Date();
      await tx.transaction.upsert({
        where: { id: transaction.id },
        create: {
          id: transaction.id,
          walletId: transaction.walletId,
          accountId: transaction.accountId,
          type: transaction.type as PrismaTransactionType,
          amountCents: transaction.amountCents,
          occurredAt,
          description: transaction.description,
          categoryId: transaction.categoryId ?? null,
          counterpartyAccountId: transaction.counterpartyAccountId ?? null,
          deletedAt: deleteTimestamp
        },
        update: {
          deletedAt: deleteTimestamp
        }
      });
      return;
    }

    await tx.transaction.upsert({
      where: { id: transaction.id },
      create: {
        id: transaction.id,
        walletId: transaction.walletId,
        accountId: transaction.accountId,
        type: transaction.type as PrismaTransactionType,
        amountCents: transaction.amountCents,
        occurredAt,
        description: transaction.description,
        categoryId: transaction.categoryId ?? null,
        counterpartyAccountId: transaction.counterpartyAccountId ?? null,
        deletedAt: null
      },
      update: {
        accountId: transaction.accountId,
        type: transaction.type as PrismaTransactionType,
        amountCents: transaction.amountCents,
        occurredAt,
        description: transaction.description,
        categoryId: transaction.categoryId ?? null,
        counterpartyAccountId: transaction.counterpartyAccountId ?? null,
        deletedAt: null
      }
    });
  }

  private normalizeTransactionPayload(payload: unknown, walletId: string): TransactionPayload {
    if (!payload || typeof payload !== "object") {
      throw new BadRequestException("Invalid transaction payload");
    }

    const data = payload as Record<string, unknown>;
    const id = typeof data.id === "string" ? data.id : "";
    if (!id || !this.uuidRegex.test(id)) {
      throw new BadRequestException("Invalid transaction payload");
    }

    const type =
      data.type === SharedTransactionType.INCOME ||
      data.type === SharedTransactionType.EXPENSE ||
      data.type === SharedTransactionType.TRANSFER
        ? data.type
        : SharedTransactionType.EXPENSE;

    let amountCents =
      typeof data.amountCents === "number" ? data.amountCents : Number(data.amountCents ?? 0);
    if (!Number.isFinite(amountCents)) {
      amountCents = 0;
    }
    if (!Number.isInteger(amountCents)) {
      amountCents = Math.round(amountCents);
    }
    if (amountCents < 0) {
      amountCents = Math.abs(amountCents);
    }

    const rawOccurredAt = typeof data.occurredAt === "string" ? data.occurredAt : new Date().toISOString();
    const occurredAtDate = new Date(rawOccurredAt);
    const hasOccurredAtTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(rawOccurredAt);
    const occurredAt = Number.isNaN(occurredAtDate.getTime())
      ? new Date().toISOString()
      : !rawOccurredAt.includes("T") || !hasOccurredAtTimezone
      ? occurredAtDate.toISOString()
      : rawOccurredAt;

    let description = typeof data.description === "string" ? data.description : String(data.description ?? "");
    if (!description.trim()) {
      description = "Sem descricao";
    }

    const rawDeletedAt = typeof data.deletedAt === "string" ? data.deletedAt : null;
    let deletedAt: string | null = null;
    if (rawDeletedAt) {
      const deletedAtDate = new Date(rawDeletedAt);
      const hasDeletedAtTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(rawDeletedAt);
      if (!Number.isNaN(deletedAtDate.getTime())) {
        deletedAt = !rawDeletedAt.includes("T") || !hasDeletedAtTimezone ? deletedAtDate.toISOString() : rawDeletedAt;
      }
    }

    return {
      id,
      walletId,
      accountId:
        typeof data.accountId === "string" && this.uuidRegex.test(data.accountId) ? data.accountId : "",
      type,
      amountCents,
      occurredAt,
      description,
      categoryId:
        typeof data.categoryId === "string" && this.uuidRegex.test(data.categoryId) ? data.categoryId : null,
      counterpartyAccountId:
        typeof data.counterpartyAccountId === "string" && this.uuidRegex.test(data.counterpartyAccountId)
          ? data.counterpartyAccountId
          : null,
      deletedAt
    };
  }

  private async getFallbackAccountId(tx: Prisma.TransactionClient, walletId: string) {
    const account = await tx.account.findFirst({
      where: { walletId },
      orderBy: { createdAt: "asc" }
    });
    return account?.id ?? null;
  }

  private normalizePayload(payload: unknown): Prisma.InputJsonValue {
    if (payload === undefined) {
      throw new BadRequestException("payload is required");
    }
    try {
      return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
    } catch {
      throw new BadRequestException("Invalid sync payload");
    }
  }

  private buildSyncError(
    error: unknown,
    event: { eventId?: string; eventType?: SyncEventType }
  ) {
    const base = {
      message: "SYNC_EVENT_FAILED",
      eventId: event.eventId ?? null,
      eventType: event.eventType ?? null
    };

    if (error instanceof BadRequestException) {
      const response = error.getResponse();
      const reason =
        typeof response === "string"
          ? response
          : typeof response === "object" && response && "message" in response
          ? (response as { message?: string | string[] }).message
          : error.message;
      return new BadRequestException({
        ...base,
        reason
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return new BadRequestException({
        ...base,
        reason: error.message,
        code: error.code
      });
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return new BadRequestException({
        ...base,
        reason: "Invalid sync payload"
      });
    }

    return new BadRequestException({
      ...base,
      reason: error instanceof Error ? error.message : "Unknown sync error"
    });
  }

  private normalizeNumber(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return fallback;
    }
    return parsed;
  }

  private get snapshotEventInterval() {
    return this.normalizeNumber(process.env.SYNC_SNAPSHOT_EVENT_INTERVAL, DEFAULT_SNAPSHOT_EVENT_INTERVAL);
  }

  private get snapshotMaxAgeHours() {
    return this.normalizeNumber(process.env.SYNC_SNAPSHOT_MAX_AGE_HOURS, DEFAULT_SNAPSHOT_MAX_AGE_HOURS);
  }

  private get compactionEnabled() {
    return process.env.SYNC_COMPACTION_ENABLED === "true";
  }

  private get compactionKeepSeq() {
    return this.normalizeNumber(process.env.SYNC_COMPACTION_KEEP_SEQ, DEFAULT_COMPACTION_KEEP_SEQ);
  }

  private async maybeCreateSnapshot(
    tx: Prisma.TransactionClient,
    walletId: string,
    currentSeq: number
  ) {
    const interval = this.snapshotEventInterval;
    if (!interval || currentSeq <= 0) {
      return;
    }

    const lastSnapshot = await tx.walletSnapshot.findFirst({
      where: { walletId },
      orderBy: { createdAt: "desc" }
    });

    if (lastSnapshot) {
      const delta = currentSeq - lastSnapshot.lastServerSeq;
      const ageMs = Date.now() - lastSnapshot.createdAt.getTime();
      const maxAgeMs = this.snapshotMaxAgeHours * 60 * 60 * 1000;
      if (delta < interval && ageMs < maxAgeMs) {
        return;
      }
    } else if (currentSeq < interval) {
      return;
    }

    const transactions = await tx.transaction.findMany({
      where: { walletId },
      select: {
        id: true,
        walletId: true,
        accountId: true,
        type: true,
        amountCents: true,
        occurredAt: true,
        description: true,
        categoryId: true,
        counterpartyAccountId: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    const state = {
      transactions: transactions.map((item) => ({
        id: item.id,
        walletId: item.walletId,
        accountId: item.accountId,
        type: item.type,
        amountCents: item.amountCents,
        occurredAt: item.occurredAt.toISOString(),
        description: item.description,
        categoryId: item.categoryId ?? null,
        counterpartyAccountId: item.counterpartyAccountId ?? null,
        deletedAt: item.deletedAt ? item.deletedAt.toISOString() : null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
      }))
    };

    const snapshot = await tx.walletSnapshot.create({
      data: {
        walletId,
        lastServerSeq: currentSeq,
        state
      }
    });

    await this.maybeCompactEvents(tx, walletId, snapshot.lastServerSeq);
  }

  private async maybeCompactEvents(
    tx: Prisma.TransactionClient,
    walletId: string,
    snapshotSeq: number
  ) {
    if (!this.compactionEnabled) {
      return;
    }

    const keepSeq = this.compactionKeepSeq;
    const cutoff = snapshotSeq - keepSeq;
    if (cutoff <= 0) {
      return;
    }

    await tx.syncEvent.deleteMany({
      where: {
        walletId,
        serverSeq: { lte: cutoff }
      }
    });
  }
}
