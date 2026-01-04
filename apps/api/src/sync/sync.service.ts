import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, SyncEventType, TransactionType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TransactionPayloadSchema } from "@gf/shared";
import { ZodError } from "zod";

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

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

        await tx.syncEvent.create({
          data: {
            eventId: event.eventId,
            walletId,
            userId,
            deviceId,
            eventType: event.eventType,
            payload: event.payload as Prisma.InputJsonValue,
            serverSeq
          }
        });

        await this.applyEvent(tx, walletId, event.eventType, event.payload);

        applied.push({ eventId: event.eventId, serverSeq });
      }

      const wallet = await tx.wallet.findUnique({ where: { id: walletId } });

      return {
        appliedCount: applied.length,
        lastSeq: wallet?.serverSeq ?? 0
      };
    });
  }

  async pullEvents(walletId: string, sinceSeq: number) {
    const events = await this.prisma.syncEvent.findMany({
      where: {
        walletId,
        serverSeq: { gt: sinceSeq }
      },
      orderBy: { serverSeq: "asc" }
    });

    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });

    return {
      walletId,
      nextSeq: wallet?.serverSeq ?? sinceSeq,
      events: events.map((event) => ({
        eventId: event.eventId,
        walletId: event.walletId,
        userId: event.userId,
        deviceId: event.deviceId,
        eventType: event.eventType,
        payload: event.payload,
        serverSeq: event.serverSeq,
        serverReceivedAt: event.serverReceivedAt.toISOString()
      }))
    };
  }

  private async nextWalletSeq(tx: Prisma.TransactionClient, walletId: string) {
    const result = await tx.$queryRaw<{ server_seq: number }[]>`
      UPDATE "Wallet"
      SET "server_seq" = "server_seq" + 1
      WHERE "id" = ${walletId}
      RETURNING "server_seq"
    `;

    if (!result[0]) {
      throw new BadRequestException("Wallet not found");
    }

    return result[0].server_seq;
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

    let transaction: ReturnType<typeof TransactionPayloadSchema.parse>;
    try {
      transaction = TransactionPayloadSchema.parse(payload);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException("Invalid transaction payload");
      }
      throw error;
    }

    if (transaction.walletId !== walletId) {
      throw new BadRequestException("Transaction wallet mismatch");
    }

    if (transaction.amountCents <= 0) {
      throw new BadRequestException("amount_cents must be positive");
    }

    if (!transaction.description.trim()) {
      throw new BadRequestException("description is required");
    }

    if (transaction.type === TransactionType.TRANSFER) {
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
      throw new BadRequestException("Invalid account_id");
    }

    if (transaction.categoryId) {
      const category = await tx.category.findFirst({
        where: { id: transaction.categoryId, walletId }
      });
      if (!category) {
        throw new BadRequestException("Invalid category_id");
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
          type: transaction.type as TransactionType,
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
        type: transaction.type as TransactionType,
        amountCents: transaction.amountCents,
        occurredAt,
        description: transaction.description,
        categoryId: transaction.categoryId ?? null,
        counterpartyAccountId: transaction.counterpartyAccountId ?? null,
        deletedAt: null
      },
      update: {
        accountId: transaction.accountId,
        type: transaction.type as TransactionType,
        amountCents: transaction.amountCents,
        occurredAt,
        description: transaction.description,
        categoryId: transaction.categoryId ?? null,
        counterpartyAccountId: transaction.counterpartyAccountId ?? null,
        deletedAt: null
      }
    });
  }
}
