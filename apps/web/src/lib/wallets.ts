"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { WalletRole } from "@gf/shared";
import { useAuth } from "@/lib/auth";

export type WalletAccount = { id: string; name: string };
export type WalletSummary = { id: string; name: string; accounts?: WalletAccount[] };
export type WalletEntry = { role: WalletRole; wallet: WalletSummary };

async function fetchWallets(authFetch: (path: string, options?: RequestInit) => Promise<Response>) {
  const res = await authFetch("/wallets");
  if (!res.ok) {
    throw new Error("Failed to load wallets");
  }
  return (await res.json()) as WalletEntry[];
}

export function useWallets() {
  const { authFetch, user } = useAuth();
  return useQuery({
    queryKey: ["wallets"],
    queryFn: () => fetchWallets(authFetch),
    enabled: Boolean(user)
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
