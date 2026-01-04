"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { loadWalletsCache, saveWalletsCache } from "@/lib/wallet-cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RequireAuth } from "@/components/require-auth";

export default function WalletsPage() {
  const router = useRouter();
  const { authFetch, logout, user } = useAuth();
  const [name, setName] = useState("");

  const walletsQuery = useQuery({
    queryKey: ["wallets"],
    queryFn: async () => {
      const res = await authFetch("/wallets");
      if (!res.ok) {
        throw new Error("Failed to load wallets");
      }
      return (await res.json()) as Array<{ role: string; wallet: { id: string; name: string; accounts?: { id: string; name: string }[] } }>;
    },
    enabled: Boolean(user)
  });

  useEffect(() => {
    if (walletsQuery.data) {
      saveWalletsCache(walletsQuery.data);
    }
  }, [walletsQuery.data]);

  const cachedWallets = useMemo(() => loadWalletsCache(), []);
  const wallets = walletsQuery.data ?? cachedWallets.map((wallet) => ({
    role: wallet.role,
    wallet: {
      id: wallet.id,
      name: wallet.name,
      accounts: wallet.accounts
    }
  }));

  const handleCreate = async () => {
    if (!name.trim()) return;
    const res = await authFetch("/wallets", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      setName("");
      walletsQuery.refetch();
    }
  };

  return (
    <RequireAuth>
      <div className="min-h-screen px-6 py-10">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Suas carteiras</h1>
            <p className="text-sm text-gray-600">Selecione uma carteira para iniciar.</p>
          </div>
          <Button variant="outline" onClick={logout}>
            Sair
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Criar nova carteira</CardTitle>
            <CardDescription>Uma conta compartilhada para o casal.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Nome da carteira"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button onClick={handleCreate}>Criar</Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {wallets.map((entry) => (
            <Card key={entry.wallet.id} className="cursor-pointer hover:shadow-md" onClick={() => router.push(`/wallets/${entry.wallet.id}`)}>
              <CardHeader>
                <CardTitle>{entry.wallet.name}</CardTitle>
                <CardDescription>Papel: {entry.role}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  {entry.wallet.accounts?.length ?? 0} conta(s)
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {walletsQuery.isLoading && <p className="text-sm text-gray-600">Carregando...</p>}
        {walletsQuery.error && <p className="text-sm text-red-600">Nao foi possivel atualizar as carteiras.</p>}
        </div>
      </div>
    </RequireAuth>
  );
}
