const CACHE_KEY = "gf.wallets";

export type WalletAccount = { id: string; name: string };
export type WalletSummary = { id: string; name: string; role: string; accounts: WalletAccount[] };

export function saveWalletsCache(data: { role: string; wallet: { id: string; name: string; accounts?: WalletAccount[] } }[]) {
  if (typeof window === "undefined") {
    return;
  }

  const wallets: WalletSummary[] = data.map((entry) => ({
    id: entry.wallet.id,
    name: entry.wallet.name,
    role: entry.role,
    accounts: entry.wallet.accounts ?? []
  }));

  window.localStorage.setItem(CACHE_KEY, JSON.stringify({ wallets }));
}

export function loadWalletsCache(): WalletSummary[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(CACHE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as { wallets: WalletSummary[] };
    return parsed.wallets ?? [];
  } catch {
    return [];
  }
}

export function getWalletAccounts(walletId: string): WalletAccount[] {
  const wallets = loadWalletsCache();
  return wallets.find((wallet) => wallet.id === walletId)?.accounts ?? [];
}

export function getWalletRole(walletId: string): string | null {
  const wallets = loadWalletsCache();
  return wallets.find((wallet) => wallet.id === walletId)?.role ?? null;
}
