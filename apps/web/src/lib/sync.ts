import {
  buildRecurringOccurrenceIso,
  getCurrentMonthKey,
  isMonthKey,
  isRecurringExpenseActiveForMonth,
  RecurringExpensePayload,
  SyncEventType,
  TransactionPayload,
  TransactionType,
  toMonthKey
} from "@gf/shared";
import {
  db,
  getMetadata,
  setMetadata,
  type SyncEventLocal
} from "./db";

export type SyncEventServer = {
  eventId: string;
  walletId: string;
  userId: string;
  deviceId: string;
  eventType: SyncEventType;
  payload: TransactionPayload | RecurringExpensePayload;
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

type TransactionMutationParams = {
  id?: string;
  walletId: string;
  accountId: string;
  type: TransactionType;
  amountCents: number;
  occurredAt: string;
  description: string;
  categoryId?: string | null;
  counterpartyAccountId?: string | null;
  recurringExpenseId?: string | null;
  recurringMonth?: string | null;
  userId: string;
  deviceId: string;
};

type RecurringExpenseMutationParams = {
  id?: string;
  walletId: string;
  accountId: string;
  description: string;
  amountCents: number;
  categoryId?: string | null;
  dayOfMonth: number;
  startMonth: string;
  archivedAt?: string | null;
  userId: string;
  deviceId: string;
};

function isTransactionEvent(eventType: SyncEventType) {
  return (
    eventType === SyncEventType.TRANSACTION_CREATED ||
    eventType === SyncEventType.TRANSACTION_UPDATED ||
    eventType === SyncEventType.TRANSACTION_DELETED
  );
}

function isRecurringExpenseEvent(eventType: SyncEventType) {
  return (
    eventType === SyncEventType.RECURRING_EXPENSE_CREATED ||
    eventType === SyncEventType.RECURRING_EXPENSE_UPDATED ||
    eventType === SyncEventType.RECURRING_EXPENSE_DELETED
  );
}

function buildTransactionPayload(params: TransactionMutationParams): TransactionPayload {
  const recurringExpenseId =
    params.type === TransactionType.EXPENSE && params.recurringExpenseId ? params.recurringExpenseId : null;
  const recurringMonth =
    recurringExpenseId && isMonthKey(params.recurringMonth)
      ? params.recurringMonth
      : recurringExpenseId
      ? toMonthKey(params.occurredAt)
      : null;

  return {
    id: params.id ?? crypto.randomUUID(),
    walletId: params.walletId,
    accountId: params.accountId,
    type: params.type,
    amountCents: params.amountCents,
    occurredAt: params.occurredAt,
    description: params.description,
    categoryId: params.categoryId ?? null,
    counterpartyAccountId: params.counterpartyAccountId ?? null,
    deletedAt: null,
    recurringExpenseId,
    recurringMonth
  };
}

function buildRecurringExpensePayload(params: RecurringExpenseMutationParams): RecurringExpensePayload {
  return {
    id: params.id ?? crypto.randomUUID(),
    walletId: params.walletId,
    accountId: params.accountId,
    description: params.description,
    amountCents: params.amountCents,
    categoryId: params.categoryId ?? null,
    dayOfMonth: params.dayOfMonth,
    startMonth: params.startMonth,
    archivedAt: params.archivedAt ?? null
  };
}

async function queueTransactionEvent(params: {
  eventType: SyncEventType;
  payload: TransactionPayload;
  userId: string;
  deviceId: string;
  now?: string;
}) {
  const eventId = crypto.randomUUID();
  const now = params.now ?? new Date().toISOString();
  const existing = await db.transactions_local.get(params.payload.id);
  const createdAt = existing?.createdAt ?? now;
  const serverSeq = existing?.serverSeq ?? null;

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
    recurringExpenseId: params.payload.recurringExpenseId ?? null,
    recurringMonth: params.payload.recurringMonth ?? null,
    deletedAt: params.payload.deletedAt ?? null,
    createdAt,
    serverSeq,
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

  return params.payload.id;
}

async function queueRecurringExpenseEvent(params: {
  eventType: SyncEventType;
  payload: RecurringExpensePayload;
  userId: string;
  deviceId: string;
  now?: string;
}) {
  const eventId = crypto.randomUUID();
  const now = params.now ?? new Date().toISOString();
  const existing = await db.recurring_expenses_local.get(params.payload.id);
  const createdAt = existing?.createdAt ?? now;
  const serverSeq = existing?.serverSeq ?? null;

  await db.recurring_expenses_local.put({
    id: params.payload.id,
    walletId: params.payload.walletId,
    accountId: params.payload.accountId,
    description: params.payload.description,
    amountCents: params.payload.amountCents,
    categoryId: params.payload.categoryId ?? null,
    dayOfMonth: params.payload.dayOfMonth,
    startMonth: params.payload.startMonth,
    archivedAt: params.payload.archivedAt ?? null,
    createdAt,
    serverSeq,
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

  return params.payload.id;
}

export async function createLocalTransaction(params: TransactionMutationParams) {
  const payload = buildTransactionPayload(params);

  await db.transaction("rw", db.transactions_local, db.sync_events_local, async () => {
    await queueTransactionEvent({
      eventType: SyncEventType.TRANSACTION_CREATED,
      payload,
      userId: params.userId,
      deviceId: params.deviceId
    });
  });

  return payload.id;
}

export async function updateLocalTransaction(params: TransactionMutationParams & { id: string }) {
  const payload = buildTransactionPayload(params);

  await db.transaction("rw", db.transactions_local, db.sync_events_local, async () => {
    await queueTransactionEvent({
      eventType: SyncEventType.TRANSACTION_UPDATED,
      payload,
      userId: params.userId,
      deviceId: params.deviceId
    });
  });
}

export async function deleteLocalTransaction(params: TransactionMutationParams & { id: string }) {
  const payload = {
    ...buildTransactionPayload(params),
    deletedAt: new Date().toISOString()
  };

  await db.transaction("rw", db.transactions_local, db.sync_events_local, async () => {
    await queueTransactionEvent({
      eventType: SyncEventType.TRANSACTION_DELETED,
      payload,
      userId: params.userId,
      deviceId: params.deviceId
    });
  });
}

export async function createLocalRecurringExpense(params: RecurringExpenseMutationParams) {
  const payload = buildRecurringExpensePayload(params);

  await db.transaction("rw", db.recurring_expenses_local, db.sync_events_local, async () => {
    await queueRecurringExpenseEvent({
      eventType: SyncEventType.RECURRING_EXPENSE_CREATED,
      payload,
      userId: params.userId,
      deviceId: params.deviceId
    });
  });

  return payload.id;
}

export async function updateLocalRecurringExpense(params: RecurringExpenseMutationParams & { id: string }) {
  const payload = buildRecurringExpensePayload(params);

  await db.transaction("rw", db.recurring_expenses_local, db.sync_events_local, async () => {
    await queueRecurringExpenseEvent({
      eventType: SyncEventType.RECURRING_EXPENSE_UPDATED,
      payload,
      userId: params.userId,
      deviceId: params.deviceId
    });
  });
}

export async function deleteLocalRecurringExpense(params: RecurringExpenseMutationParams & { id: string }) {
  const payload = buildRecurringExpensePayload({
    ...params,
    archivedAt: params.archivedAt ?? new Date().toISOString()
  });

  await db.transaction("rw", db.recurring_expenses_local, db.sync_events_local, async () => {
    await queueRecurringExpenseEvent({
      eventType: SyncEventType.RECURRING_EXPENSE_DELETED,
      payload,
      userId: params.userId,
      deviceId: params.deviceId
    });
  });
}

export async function createLocalRecurringExpenseWithTransaction(params: {
  walletId: string;
  accountId: string;
  description: string;
  amountCents: number;
  categoryId?: string | null;
  occurredAt: string;
  dayOfMonth: number;
  startMonth?: string | null;
  userId: string;
  deviceId: string;
}) {
  const recurringExpenseId = crypto.randomUUID();
  const recurringStartMonth = params.startMonth ?? toMonthKey(params.occurredAt) ?? getCurrentMonthKey() ?? "1970-01";
  const transactionMonth = toMonthKey(params.occurredAt) ?? recurringStartMonth;
  const recurringPayload = buildRecurringExpensePayload({
    id: recurringExpenseId,
    walletId: params.walletId,
    accountId: params.accountId,
    description: params.description,
    amountCents: params.amountCents,
    categoryId: params.categoryId ?? null,
    dayOfMonth: params.dayOfMonth,
    startMonth: recurringStartMonth,
    userId: params.userId,
    deviceId: params.deviceId
  });
  const transactionPayload = buildTransactionPayload({
    walletId: params.walletId,
    accountId: params.accountId,
    type: TransactionType.EXPENSE,
    amountCents: params.amountCents,
    occurredAt: params.occurredAt,
    description: params.description,
    categoryId: params.categoryId ?? null,
    counterpartyAccountId: null,
    recurringExpenseId,
    recurringMonth: transactionMonth,
    userId: params.userId,
    deviceId: params.deviceId
  });
  const recurringEventAt = new Date();
  const transactionEventAt = new Date(recurringEventAt.getTime() + 1);

  await db.transaction(
    "rw",
    db.recurring_expenses_local,
    db.transactions_local,
    db.sync_events_local,
    async () => {
      await queueRecurringExpenseEvent({
        eventType: SyncEventType.RECURRING_EXPENSE_CREATED,
        payload: recurringPayload,
        userId: params.userId,
        deviceId: params.deviceId,
        now: recurringEventAt.toISOString()
      });
      await queueTransactionEvent({
        eventType: SyncEventType.TRANSACTION_CREATED,
        payload: transactionPayload,
        userId: params.userId,
        deviceId: params.deviceId,
        now: transactionEventAt.toISOString()
      });
    }
  );

  return {
    recurringExpenseId,
    transactionId: transactionPayload.id
  };
}

export async function ensureCurrentMonthRecurringTransactions(params: {
  walletId: string;
  userId: string;
  deviceId: string;
}) {
  const monthKey = getCurrentMonthKey();
  if (!monthKey) {
    return 0;
  }

  return db.transaction(
    "rw",
    db.recurring_expenses_local,
    db.transactions_local,
    db.sync_events_local,
    async () => {
      const [recurringExpenses, transactions] = await Promise.all([
        db.recurring_expenses_local.where("walletId").equals(params.walletId).toArray(),
        db.transactions_local.where("walletId").equals(params.walletId).toArray()
      ]);

      const existingBySeries = new Set(
        transactions
          .filter((transaction) => transaction.recurringExpenseId && transaction.recurringMonth === monthKey)
          .map((transaction) => `${transaction.recurringExpenseId}:${transaction.recurringMonth}`)
      );

      let created = 0;
      for (const recurring of recurringExpenses) {
        if (
          !isRecurringExpenseActiveForMonth({
            startMonth: recurring.startMonth,
            archivedAt: recurring.archivedAt ?? null,
            monthKey
          })
        ) {
          continue;
        }

        const key = `${recurring.id}:${monthKey}`;
        if (existingBySeries.has(key)) {
          continue;
        }

        const payload = buildTransactionPayload({
          walletId: params.walletId,
          accountId: recurring.accountId,
          type: TransactionType.EXPENSE,
          amountCents: recurring.amountCents,
          occurredAt: buildRecurringOccurrenceIso(monthKey, recurring.dayOfMonth),
          description: recurring.description,
          categoryId: recurring.categoryId ?? null,
          counterpartyAccountId: null,
          recurringExpenseId: recurring.id,
          recurringMonth: monthKey,
          userId: params.userId,
          deviceId: params.deviceId
        });

        await queueTransactionEvent({
          eventType: SyncEventType.TRANSACTION_CREATED,
          payload,
          userId: params.userId,
          deviceId: params.deviceId
        });

        existingBySeries.add(key);
        created += 1;
      }

      return created;
    }
  );
}

export async function syncNow({ walletId, userId, deviceId, authFetch }: SyncParams) {
  await sanitizePendingEvents(walletId);
  await ensureCurrentMonthRecurringTransactions({ walletId, userId, deviceId });

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
    await ensureCurrentMonthRecurringTransactions({ walletId, userId, deviceId });
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

  await db.transaction(
    "rw",
    db.sync_events_local,
    db.transactions_local,
    db.recurring_expenses_local,
    async () => {
      for (const event of pending) {
        if (isTransactionEvent(event.eventType)) {
          await sanitizePendingTransactionEvent(event, walletId, categoryIds, hasCategoryIndex);
          continue;
        }
        if (isRecurringExpenseEvent(event.eventType)) {
          await sanitizePendingRecurringExpenseEvent(event, walletId, categoryIds, hasCategoryIndex);
        }
      }
    }
  );
}

async function sanitizePendingTransactionEvent(
  event: SyncEventLocal,
  walletId: string,
  categoryIds: Set<string>,
  hasCategoryIndex: boolean
) {
  const payload = event.payload as Partial<TransactionPayload> | null | undefined;
  if (!payload || payload.walletId !== walletId || !payload.id || !payload.accountId) {
    return;
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
    deletedAt: typeof payload.deletedAt === "string" ? payload.deletedAt : null,
    recurringExpenseId:
      typeof payload.recurringExpenseId === "string" ? payload.recurringExpenseId : null,
    recurringMonth: isMonthKey(payload.recurringMonth) ? payload.recurringMonth : null
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

  if (nextPayload.type !== TransactionType.EXPENSE) {
    if (nextPayload.recurringExpenseId || nextPayload.recurringMonth) {
      nextPayload.recurringExpenseId = null;
      nextPayload.recurringMonth = null;
      changed = true;
    }
  } else if (nextPayload.recurringExpenseId) {
    const derivedMonth = nextPayload.recurringMonth ?? toMonthKey(nextPayload.occurredAt);
    if (derivedMonth !== nextPayload.recurringMonth) {
      nextPayload.recurringMonth = derivedMonth;
      changed = true;
    }
  } else if (nextPayload.recurringMonth) {
    nextPayload.recurringMonth = null;
    changed = true;
  }

  if (!changed) {
    return;
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
    recurringExpenseId: nextPayload.recurringExpenseId ?? null,
    recurringMonth: nextPayload.recurringMonth ?? null,
    deletedAt: nextPayload.deletedAt ?? null,
    updatedAt: now
  });
}

async function sanitizePendingRecurringExpenseEvent(
  event: SyncEventLocal,
  walletId: string,
  categoryIds: Set<string>,
  hasCategoryIndex: boolean
) {
  const payload = event.payload as Partial<RecurringExpensePayload> | null | undefined;
  if (!payload || payload.walletId !== walletId || !payload.id || !payload.accountId) {
    return;
  }

  let changed = false;
  const nextPayload: RecurringExpensePayload = {
    id: payload.id,
    walletId: payload.walletId ?? walletId,
    accountId: payload.accountId,
    description: typeof payload.description === "string" ? payload.description : String(payload.description ?? ""),
    amountCents:
      typeof payload.amountCents === "number"
        ? payload.amountCents
        : Number(payload.amountCents ?? 0),
    categoryId: typeof payload.categoryId === "string" ? payload.categoryId : null,
    dayOfMonth:
      typeof payload.dayOfMonth === "number" ? Math.trunc(payload.dayOfMonth) : Number(payload.dayOfMonth ?? 1),
    startMonth:
      isMonthKey(payload.startMonth) ? payload.startMonth : toMonthKey(new Date().toISOString()) ?? "1970-01",
    archivedAt: typeof payload.archivedAt === "string" ? payload.archivedAt : null
  };

  if (hasCategoryIndex && nextPayload.categoryId && !categoryIds.has(nextPayload.categoryId)) {
    nextPayload.categoryId = null;
    changed = true;
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

  if (nextPayload.dayOfMonth < 1 || nextPayload.dayOfMonth > 31 || !Number.isFinite(nextPayload.dayOfMonth)) {
    nextPayload.dayOfMonth = 1;
    changed = true;
  }

  if (!nextPayload.description.trim()) {
    nextPayload.description = "Sem descricao";
    changed = true;
  }

  if (nextPayload.archivedAt) {
    const archivedAt = new Date(nextPayload.archivedAt);
    const hasArchivedTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(nextPayload.archivedAt);
    if (Number.isNaN(archivedAt.getTime())) {
      nextPayload.archivedAt = null;
      changed = true;
    } else if (!nextPayload.archivedAt.includes("T") || !hasArchivedTimezone) {
      nextPayload.archivedAt = archivedAt.toISOString();
      changed = true;
    }
  }

  if (!changed) {
    return;
  }

  const now = new Date().toISOString();
  await db.sync_events_local.update(event.eventId, { payload: nextPayload });
  await db.recurring_expenses_local.update(nextPayload.id, {
    accountId: nextPayload.accountId,
    description: nextPayload.description,
    amountCents: nextPayload.amountCents,
    categoryId: nextPayload.categoryId ?? null,
    dayOfMonth: nextPayload.dayOfMonth,
    startMonth: nextPayload.startMonth,
    archivedAt: nextPayload.archivedAt ?? null,
    updatedAt: now
  });
}

async function applyRemoteEvents(events: SyncEventServer[]) {
  await db.transaction(
    "rw",
    db.transactions_local,
    db.recurring_expenses_local,
    db.sync_events_local,
    async () => {
      for (const event of events) {
        if (isTransactionEvent(event.eventType)) {
          await applyRemoteTransactionEvent(event);
          continue;
        }
        if (isRecurringExpenseEvent(event.eventType)) {
          await applyRemoteRecurringExpenseEvent(event);
        }
      }
    }
  );
}

async function applyRemoteTransactionEvent(event: SyncEventServer) {
  const payload = event.payload as TransactionPayload;
  const existing = await db.transactions_local.get(payload.id);
  const createdAt = existing?.createdAt ?? event.serverReceivedAt ?? new Date().toISOString();
  const updatedAt = new Date().toISOString();

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
    recurringExpenseId: payload.recurringExpenseId ?? null,
    recurringMonth: payload.recurringMonth ?? null,
    deletedAt:
      event.eventType === SyncEventType.TRANSACTION_DELETED
        ? payload.deletedAt ?? new Date().toISOString()
        : null,
    createdAt,
    serverSeq: event.serverSeq,
    updatedAt
  });

  await db.sync_events_local.update(event.eventId, { status: "ACKED" });
}

async function applyRemoteRecurringExpenseEvent(event: SyncEventServer) {
  const payload = event.payload as RecurringExpensePayload;
  const existing = await db.recurring_expenses_local.get(payload.id);
  const createdAt = existing?.createdAt ?? event.serverReceivedAt ?? new Date().toISOString();
  const updatedAt = new Date().toISOString();

  await db.recurring_expenses_local.put({
    id: payload.id,
    walletId: payload.walletId,
    accountId: payload.accountId,
    description: payload.description,
    amountCents: payload.amountCents,
    categoryId: payload.categoryId ?? null,
    dayOfMonth: payload.dayOfMonth,
    startMonth: payload.startMonth,
    archivedAt:
      event.eventType === SyncEventType.RECURRING_EXPENSE_DELETED
        ? payload.archivedAt ?? new Date().toISOString()
        : payload.archivedAt ?? null,
    createdAt,
    serverSeq: event.serverSeq,
    updatedAt
  });

  await db.sync_events_local.update(event.eventId, { status: "ACKED" });
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
