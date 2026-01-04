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
  const pending = await db.sync_events_local
    .where({ walletId, status: "PENDING" })
    .sortBy("createdAt");

  if (pending.length > 0) {
    const pushRes = await authFetch("/sync/push", {
      method: "POST",
      body: JSON.stringify({
        deviceId,
        walletId,
        events: pending.map((event) => ({
          eventId: event.eventId,
          walletId: event.walletId,
          userId: event.userId,
          deviceId: event.deviceId,
          eventType: event.eventType,
          payload: event.payload
        }))
      })
    });

    if (!pushRes.ok) {
      throw new Error("Push failed");
    }

    await Promise.all(\n      pending.map((event) => db.sync_events_local.update(event.eventId, { status: \"ACKED\" }))\n    );
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
  return value ? Number(value) : 0;
}

export async function getLastSyncAt(walletId: string) {
  const value = await getMetadata(`lastSyncAt:${walletId}`);
  return value ?? null;
}
