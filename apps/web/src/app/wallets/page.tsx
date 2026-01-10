"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useWallets } from "@/lib/wallets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";

export default function WalletsPage() {
  const router = useRouter();
  const { logout, authFetch, user } = useAuth();
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "fadomingosf@gmail.com";
  const isAdmin = user?.email?.toLowerCase() === adminEmail.toLowerCase();

  const walletsQuery = useWallets();
  const [adminWallets, setAdminWallets] = useState<Array<{ id: string; name: string; accountsCount?: number }>>(
    []
  );
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setAdminLoading(true);
    setAdminError(false);
    authFetch("/wallets/admin")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to load wallets");
        }
        const data = (await res.json()) as Array<{ id: string; name: string; accountsCount?: number }>;
        if (active) {
          setAdminWallets(data);
        }
      })
      .catch(() => {
        if (active) {
          setAdminError(true);
        }
      })
      .finally(() => {
        if (active) {
          setAdminLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isAdmin, authFetch]);

  const displayWallets = useMemo(() => {
    if (isAdmin) {
      return adminWallets.map((wallet) => ({
        id: wallet.id,
        name: wallet.name,
        accountsCount: wallet.accountsCount ?? 0
      }));
    }
    return (walletsQuery.data ?? []).map((entry) => ({
      id: entry.wallet.id,
      name: entry.wallet.name,
      accountsCount: entry.wallet.accounts?.length ?? 0
    }));
  }, [isAdmin, adminWallets, walletsQuery.data]);

  const isLoading = isAdmin ? adminLoading : walletsQuery.isLoading;
  const hasError = isAdmin ? adminError : Boolean(walletsQuery.error);

  return (
    <RequireAuth>
      <AppShell>
        <div className="space-y-6 animate-rise">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Suas carteiras</h1>
              <p className="text-sm text-muted-foreground">Selecione uma carteira para iniciar.</p>
            </div>
            <Button variant="outline" onClick={logout}>
              Sair
            </Button>
          </div>

          {displayWallets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma carteira disponivel.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {displayWallets.map((wallet) => (
                <Card
                  key={wallet.id}
                  className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-sm"
                  onClick={() => router.push(`/wallets/${wallet.id}`)}
                >
                  <CardHeader>
                    <CardTitle>{wallet.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {wallet.accountsCount} conta(s)
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {hasError && (
            <p className="text-sm text-[var(--color-danger)]">Nao foi possivel atualizar as carteiras.</p>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
