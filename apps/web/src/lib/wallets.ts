"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { WalletRole } from "@gf/shared";
import { useAuth } from "@/lib/auth";
import { db, safeDexie } from "@/lib/db";

export type WalletAccount = { id: string; name: string };
export type WalletSummary = { id: string; name: string; accounts?: WalletAccount[]; membersCount?: number };
export type WalletEntry = { role: WalletRole; wallet: WalletSummary };

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

async function persistWallets(userId: string, entries: WalletEntry[]) {
  if (!userId || entries.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const wallets = entries.map((entry) => ({
    id: entry.wallet.id,
    userId,
    name: entry.wallet.name,
    role: entry.role,
    membersCount: entry.wallet.membersCount ?? entry.wallet.accounts?.length ?? null,
    updatedAt: now
  }));

  const accounts = entries.flatMap((entry) =>
    (entry.wallet.accounts ?? [])
      .filter((account) => account && account.id && account.name)
      .map((account) => ({
        id: account.id,
        userId,
        walletId: entry.wallet.id,
        name: account.name,
        updatedAt: now
      }))
  );

  await db.transaction("rw", db.wallets_local, db.accounts_local, async () => {
    await db.wallets_local.where("userId").equals(userId).delete();
    await db.accounts_local.where("userId").equals(userId).delete();
    await db.wallets_local.bulkPut(wallets);
    if (accounts.length > 0) {
      await db.accounts_local.bulkPut(accounts);
    }
  });
}

async function readCachedWallets(userId: string) {
  if (!userId) {
    return [];
  }

  const [wallets, accounts] = await Promise.all([
    safeDexie(() => db.wallets_local.where("userId").equals(userId).toArray(), []),
    safeDexie(() => db.accounts_local.where("userId").equals(userId).toArray(), [])
  ]);

  if (wallets.length === 0) {
    return [];
  }

  const accountsByWallet = new Map<string, WalletAccount[]>();
  for (const account of accounts) {
    if (!account.walletId || !account.id || !account.name) {
      continue;
    }
    const list = accountsByWallet.get(account.walletId) ?? [];
    list.push({ id: account.id, name: account.name });
    accountsByWallet.set(account.walletId, list);
  }

  return wallets.map((wallet) => ({
    role: wallet.role,
    wallet: {
      id: wallet.id,
      name: wallet.name,
      accounts: accountsByWallet.get(wallet.id) ?? [],
      membersCount: wallet.membersCount ?? undefined
    }
  }));
}

async function fetchWallets(authFetch: (path: string, options?: RequestInit) => Promise<Response>) {
  const res = await authFetch("/wallets");
  if (!res.ok) {
    throw new Error("Failed to load wallets");
  }
  return (await res.json()) as WalletEntry[];
}

export function useWallets() {
  const { authFetch, user } = useAuth();
  const userId = user?.id ?? null;
  return useQuery({
    queryKey: ["wallets", userId],
    queryFn: async () => {
      if (!userId) {
        return [];
      }

      if (!isOnline()) {
        return readCachedWallets(userId);
      }
      try {
        const entries = await fetchWallets(authFetch);
        await persistWallets(userId, entries);
        return entries;
      } catch (error) {
        const cached = await readCachedWallets(userId);
        if (cached.length > 0) {
          return cached;
        }
        throw error;
      }
    },
    enabled: Boolean(userId)
  });
}

export function useWalletAccounts(walletId: string) {
  const walletsQuery = useWallets();
  const accounts = useMemo(() => {
    const wallet = walletsQuery.data?.find((entry) => entry.wallet.id === walletId)?.wallet;
    return wallet?.accounts ?? [];
  }, [walletId, walletsQuery.data]);

  return { accounts, isLoading: walletsQuery.isLoading, error: walletsQuery.error };
}

export function useWalletRole(walletId: string) {
  const walletsQuery = useWallets();
  const role = useMemo(() => {
    const entry = walletsQuery.data?.find((item) => item.wallet.id === walletId);
    return entry?.role ?? null;
  }, [walletId, walletsQuery.data]);

  return { role, isLoading: walletsQuery.isLoading, error: walletsQuery.error };
}
