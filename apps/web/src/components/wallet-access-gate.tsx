"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallets } from "@/lib/wallets";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";

export function WalletAccessGate({
  walletId,
  children
}: {
  walletId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const walletsQuery = useWallets();
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "fadomingosf@gmail.com";
  const isAdmin = user?.email?.toLowerCase() === adminEmail.toLowerCase();
  const hasAccess = useMemo(
    () => isAdmin || (walletsQuery.data?.some((entry) => entry.wallet.id === walletId) ?? false),
    [isAdmin, walletsQuery.data, walletId]
  );

  useEffect(() => {
    if (!loading && user && !walletsQuery.isLoading && !hasAccess) {
      router.replace("/wallets");
    }
  }, [loading, user, walletsQuery.isLoading, hasAccess, router]);

  if (loading || !user) {
    return (
      <RequireAuth>
        <AppShell walletId={walletId}>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </AppShell>
      </RequireAuth>
    );
  }

  if (!isAdmin && walletsQuery.isLoading) {
    return (
      <RequireAuth>
        <AppShell walletId={walletId}>
          <p className="text-sm text-muted-foreground">Verificando acesso...</p>
        </AppShell>
      </RequireAuth>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <RequireAuth>
      <AppShell walletId={walletId}>{children}</AppShell>
    </RequireAuth>
  );
}
