"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useWallets } from "@/lib/wallets";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";

export default function HomePage() {
  const router = useRouter();
  const { authFetch, user } = useAuth();
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "fadomingosf@gmail.com";
  const isAdmin = user?.email?.toLowerCase() === adminEmail.toLowerCase();

  const walletsQuery = useWallets();
  const [adminWallets, setAdminWallets] = useState<
    Array<{ id: string; name: string; membersCount?: number; accountsCount?: number }>
  >([]);
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
        const data = (await res.json()) as Array<{
          id: string;
          name: string;
          membersCount?: number;
          accountsCount?: number;
        }>;
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
        membersCount: wallet.membersCount ?? wallet.accountsCount ?? 0
      }));
    }
    return (walletsQuery.data ?? []).map((entry) => ({
      id: entry.wallet.id,
      name: entry.wallet.name,
      membersCount: entry.wallet.membersCount ?? entry.wallet.accounts?.length ?? 0
    }));
  }, [isAdmin, adminWallets, walletsQuery.data]);

  const isLoading = isAdmin ? adminLoading : walletsQuery.isLoading;
  const hasError = isAdmin ? adminError : Boolean(walletsQuery.error);
  const showEmpty = !isLoading && displayWallets.length === 0;

  return (
    <RequireAuth>
      <AppShell>
        <div className="space-y-8 animate-rise">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Home</h1>
              <p className="text-sm text-muted-foreground">Sua central de acesso as carteiras compartilhadas.</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <Card className="relative overflow-hidden border-0 bg-[linear-gradient(135deg,#4fa2ff,#e96878)] text-white shadow-lg">
              <div className="pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full bg-white/25 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-white/15 blur-3xl" />
              <CardContent className="relative space-y-4 p-6">
                <p className="text-xs uppercase tracking-[0.4em] text-white/70">UniConta</p>
                <p className="text-2xl font-semibold leading-snug">
                  Com o UniConta, voce e sua familia cuidam do dinheiro juntos.
                </p>
                <p className="text-sm leading-relaxed text-white/85">
                  Crie carteiras compartilhadas, registre despesas e receitas, acompanhe saldos em tempo real e mantenha tudo
                  sincronizado entre os usuarios - mesmo offline.
                </p>
                <p className="text-base font-semibold">UniConta: uma conta, varias pessoas.</p>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Suas carteiras</h2>
                <p className="text-sm text-muted-foreground">Selecione uma carteira para iniciar.</p>
              </div>

              {showEmpty ? (
                <p className="text-sm text-muted-foreground">Nenhuma carteira disponivel.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {displayWallets.map((wallet) => (
                    <Card
                      key={wallet.id}
                      className="min-h-[110px] cursor-pointer transition hover:-translate-y-0.5 hover:shadow-sm"
                      onClick={() => router.push(`/wallets/${wallet.id}`)}
                    >
                      <CardContent className="flex items-center gap-4 p-5">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                          <img
                            src="/icons/icone%20de%20carteiras.png"
                            alt=""
                            aria-hidden="true"
                            className="h-8 w-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <CardTitle className="text-base">{wallet.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{wallet.membersCount} usuario(s)</p>
                        </div>
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
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}

