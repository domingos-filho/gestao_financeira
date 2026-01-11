import { SyncEventType, TransactionPayload, TransactionType } from "@gf/shared";
import { db, getMetadata, setMetadata } from "./db";

export type SyncEventServer = {
  eventId: string;
  walletId: string;
  userId: string;
  deviceId: string;
  eventType: SyncEventType;
  payload: TransactionPayload;
  serverSeq: number;
  serverReceivedAt: string;
};

type AuthFetch = (path: string, options?: RequestInit) => Promise<Response>;

type SyncParams = {
  walletId: string;
  userId: string;
  deviceId: string;
  authFetch: AuthFetch;
};

export async function createLocalTransaction(params: {
  walletId: string;
  accountId: string;
  type: TransactionType;
  amountCents: number;
  occurredAt: string;
  description: string;
  categoryId?: string | null;
  counterpartyAccountId?: string | null;
  userId: string;
  deviceId: string;
}) {
  const payload: TransactionPayload = {
    id: crypto.randomUUID(),
    walletId: params.walletId,
    accountId: params.accountId,
    type: params.type,
    amountCents: params.amountCents,
    occurredAt: params.occurredAt,
    description: params.description,
    categoryId: params.categoryId ?? null,
    counterpartyAccountId: params.counterpartyAccountId ?? null,
    deletedAt: null
  };

  await persistLocalEvent({
    eventType: SyncEventType.TRANSACTION_CREATED,
    payload,
    userId: params.userId,
    deviceId: params.deviceId
  });

  return payload.id;
}

export async function updateLocalTransaction(params: {
  id: string;
  walletId: string;
  accountId: string;
  type: TransactionType;
  amountCents: number;
  occurredAt: string;
  description: string;
  categoryId?: string | null;
  counterpartyAccountId?: string | null;
  userId: string;
  deviceId: string;
}) {
  const payload: TransactionPayload = {
    id: params.id,
    walletId: params.walletId,
    accountId: params.accountId,
    type: params.type,
    amountCents: params.amountCents,
    occurredAt: params.occurredAt,
    description: params.description,
    categoryId: params.categoryId ?? null,
    counterpartyAccountId: params.counterpartyAccountId ?? null,
    deletedAt: null
  };

  await persistLocalEvent({
    eventType: SyncEventType.TRANSACTION_UPDATED,
    payload,
    userId: params.userId,
    deviceId: params.deviceId
  });
}

export async function deleteLocalTransaction(params: {
  id: string;
  walletId: string;
  accountId: string;
  type: TransactionType;
  amountCents: number;
  occurredAt: string;
  description: string;
  categoryId?: string | null;
  counterpartyAccountId?: string | null;
  userId: string;
  deviceId: string;
}) {
  const payload: TransactionPayload = {
    id: params.id,
    walletId: params.walletId,
    accountId: params.accountId,
    type: params.type,
    amountCents: params.amountCents,
    occurredAt: params.occurredAt,
    description: params.description,
    categoryId: params.categoryId ?? null,
    counterpartyAccountId: params.counterpartyAccountId ?? null,
    deletedAt: new Date().toISOString()
  };

  await persistLocalEvent({
    eventType: SyncEventType.TRANSACTION_DELETED,
    payload,
    userId: params.userId,
    deviceId: params.deviceId
  });
}

async function persistLocalEvent(params: {
  eventType: SyncEventType;
  payload: TransactionPayload;
  userId: string;
  deviceId: string;
}) {
  const eventId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.transaction("rw", db.transactions_local, db.sync_events_local, async () => {
    await db.transactions_local.put({
      id: params.payload.id,
      walletId: params.payload.walletId,
      accountId: params.payload.accountId,
      type: params.payload.type,
      amountCents: params.payload.amountCents,
      occurredAt: params.payload.occurredAt,
      description: params.payload.description,
      categoryId: params.payload.categoryId ?? null,
      counterpartyAccountId: params.payload.counterpartyAccountId ?? null,
      deletedAt: params.payload.deletedAt ?? null,
      updatedAt: now
    });

    await db.sync_events_local.put({
      eventId,
      walletId: params.payload.walletId,
      userId: params.userId,
      deviceId: params.deviceId,
      eventType: params.eventType,
      payload: params.payload,
      status: "PENDING",
      createdAt: now
    });
  });
}

export async function syncNow({ walletId, userId, deviceId, authFetch }: SyncParams) {
  await sanitizePendingEvents(walletId);
  const pending = await db.sync_events_local
    .where("walletId")
    .equals(walletId)
    .and((event) => event.status === "PENDING")
    .sortBy("createdAt");

  if (pending.length > 0 && pending.some((event) => event.deviceId !== deviceId)) {
    await db.sync_events_local
      .where("walletId")
      .equals(walletId)
      .and((event) => event.status === "PENDING")
      .modify({ deviceId });
  }
  if (pending.length > 0 && pending.some((event) => event.userId !== userId)) {
    await db.sync_events_local
      .where("walletId")
      .equals(walletId)
      .and((event) => event.status === "PENDING")
      .modify({ userId });
  }

  if (pending.length > 0) {
    const pushRes = await authFetch("/sync/push", {
      method: "POST",
      body: JSON.stringify({
        deviceId,
        walletId,
        events: pending.map((event) => ({
          eventId: event.eventId,
          walletId: event.walletId,
          userId,
          deviceId,
          eventType: event.eventType,
          payload: event.payload
        }))
      })
    });

    if (!pushRes.ok) {
      const details = await pushRes.text().catch(() => "");
      console.error("Sync push failed", details);
      throw new Error(details || "Push failed");
    }

    await Promise.all(
      pending.map((event) => db.sync_events_local.update(event.eventId, { status: "ACKED" }))
    );
  }

  const lastSeq = await getLastSeq(walletId);
  const pullRes = await authFetch(`/sync/pull?walletId=${walletId}&sinceSeq=${lastSeq}`);
  if (!pullRes.ok) {
    throw new Error("Pull failed");
  }

  const data = (await pullRes.json()) as { nextSeq: number; events: SyncEventServer[] };

  if (data.events.length > 0) {
    await applyRemoteEvents(data.events);
  }

  await setMetadata(`lastSeq:${walletId}`, String(data.nextSeq));
  await setMetadata(`lastSyncAt:${walletId}`, new Date().toISOString());
}

async function sanitizePendingEvents(walletId: string) {
  const [categories, pending] = await Promise.all([
    db.categories_local.where("walletId").equals(walletId).toArray(),
    db.sync_events_local
      .where("walletId")
      .equals(walletId)
      .and((event) => event.status === "PENDING")
      .toArray()
  ]);

  if (pending.length === 0) {
    return;
  }

  const categoryIds = new Set(categories.map((category) => category.id));
  const hasCategoryIndex = categoryIds.size > 0;

  await db.transaction("rw", db.sync_events_local, db.transactions_local, async () => {
    for (const event of pending) {
      const payload = event.payload as Partial<TransactionPayload> | null | undefined;
      if (!payload || payload.walletId !== walletId || !payload.id || !payload.accountId) {
        continue;
      }

      let changed = false;
      const nextType =
        payload.type === TransactionType.INCOME ||
        payload.type === TransactionType.EXPENSE ||
        payload.type === TransactionType.TRANSFER
          ? payload.type
          : TransactionType.EXPENSE;

      const nextPayload: TransactionPayload = {
        id: payload.id,
        walletId: payload.walletId ?? walletId,
        accountId: payload.accountId,
        type: nextType,
        amountCents:
          typeof payload.amountCents === "number"
            ? payload.amountCents
            : Number(payload.amountCents ?? 0),
        occurredAt: typeof payload.occurredAt === "string" ? payload.occurredAt : new Date().toISOString(),
        description: typeof payload.description === "string" ? payload.description : String(payload.description ?? ""),
        categoryId: typeof payload.categoryId === "string" ? payload.categoryId : null,
        counterpartyAccountId:
          typeof payload.counterpartyAccountId === "string" ? payload.counterpartyAccountId : null,
        deletedAt: typeof payload.deletedAt === "string" ? payload.deletedAt : null
      };
      if (payload.type !== nextType) {
        changed = true;
      }

      if (hasCategoryIndex && nextPayload.categoryId && !categoryIds.has(nextPayload.categoryId)) {
        nextPayload.categoryId = null;
        changed = true;
      }

      const occurredAt = new Date(nextPayload.occurredAt);
      const hasOccurredAtTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(nextPayload.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) {
        nextPayload.occurredAt = new Date().toISOString();
        changed = true;
      } else if (!nextPayload.occurredAt.includes("T") || !hasOccurredAtTimezone) {
        nextPayload.occurredAt = occurredAt.toISOString();
        changed = true;
      }

      if (nextPayload.deletedAt) {
        const deletedAt = new Date(nextPayload.deletedAt);
        const hasDeletedAtTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(nextPayload.deletedAt);
        if (Number.isNaN(deletedAt.getTime())) {
          nextPayload.deletedAt = null;
          changed = true;
        } else if (!nextPayload.deletedAt.includes("T") || !hasDeletedAtTimezone) {
          nextPayload.deletedAt = deletedAt.toISOString();
          changed = true;
        }
      }

      if (nextPayload.amountCents < 0) {
        nextPayload.amountCents = Math.abs(nextPayload.amountCents);
        changed = true;
      }
      if (!Number.isFinite(nextPayload.amountCents)) {
        nextPayload.amountCents = 0;
        changed = true;
      } else if (!Number.isInteger(nextPayload.amountCents)) {
        nextPayload.amountCents = Math.round(nextPayload.amountCents);
        changed = true;
      }

      if (!nextPayload.description.trim()) {
        nextPayload.description = "Sem descricao";
        changed = true;
      }

      if (!changed) {
        continue;
      }

      const now = new Date().toISOString();
      await db.sync_events_local.update(event.eventId, { payload: nextPayload });
      await db.transactions_local.update(nextPayload.id, {
        accountId: nextPayload.accountId,
        type: nextPayload.type,
        amountCents: nextPayload.amountCents,
        occurredAt: nextPayload.occurredAt,
        description: nextPayload.description,
        categoryId: nextPayload.categoryId ?? null,
        counterpartyAccountId: nextPayload.counterpartyAccountId ?? null,
        deletedAt: nextPayload.deletedAt ?? null,
        updatedAt: now
      });
    }
  });
}

async function applyRemoteEvents(events: SyncEventServer[]) {
  await db.transaction("rw", db.transactions_local, db.sync_events_local, async () => {
    for (const event of events) {
      const payload = event.payload;

      await db.transactions_local.put({
        id: payload.id,
        walletId: payload.walletId,
        accountId: payload.accountId,
        type: payload.type,
        amountCents: payload.amountCents,
        occurredAt: payload.occurredAt,
        description: payload.description,
        categoryId: payload.categoryId ?? null,
        counterpartyAccountId: payload.counterpartyAccountId ?? null,
        deletedAt: event.eventType === SyncEventType.TRANSACTION_DELETED ? payload.deletedAt ?? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      });

      await db.sync_events_local.update(event.eventId, { status: "ACKED" });
    }
  });
}

export async function getLastSeq(walletId: string) {
  const value = await getMetadata(`lastSeq:${walletId}`);
  if (!value) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getLastSyncAt(walletId: string) {
  const value = await getMetadata(`lastSyncAt:${walletId}`);
  return value ?? null;
}
