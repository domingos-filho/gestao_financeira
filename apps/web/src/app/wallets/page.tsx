"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useWallets } from "@/lib/wallets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";

export default function WalletsPage() {
  const router = useRouter();
  const { logout } = useAuth();

  const walletsQuery = useWallets();
  const wallets = walletsQuery.data ?? [];

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

          {wallets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma carteira disponivel.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {wallets.map((entry) => (
                <Card
                  key={entry.wallet.id}
                  className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-sm"
                  onClick={() => router.push(`/wallets/${entry.wallet.id}`)}
                >
                  <CardHeader>
                    <CardTitle>{entry.wallet.name}</CardTitle>
                    <CardDescription>Papel: {entry.role}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {entry.wallet.accounts?.length ?? 0} conta(s)
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {walletsQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {walletsQuery.error && <p className="text-sm text-red-600">Nao foi possivel atualizar as carteiras.</p>}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
