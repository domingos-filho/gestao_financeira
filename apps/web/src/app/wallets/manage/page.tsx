"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useWallets } from "@/lib/wallets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";

export default function WalletManagementPage() {
  const { authFetch, user } = useAuth();
  const walletsQuery = useWallets();
  const wallets = walletsQuery.data ?? [];
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "fadomingosf@gmail.com";
  const isAdmin = user?.email?.toLowerCase() === adminEmail.toLowerCase();

  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleCreate = async () => {
    setMessage(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setMessage("Informe um nome.");
      return;
    }

    const res = await authFetch("/wallets", {
      method: "POST",
      body: JSON.stringify({ name: trimmed })
    });

    if (!res.ok) {
      setMessage("Nao foi possivel criar.");
      return;
    }

    setName("");
    walletsQuery.refetch();
    setMessage("Carteira criada.");
  };

  const startEdit = (walletId: string, walletName: string) => {
    setMessage(null);
    setEditId(walletId);
    setEditName(walletName);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
  };

  const handleUpdate = async (walletId: string) => {
    setMessage(null);
    const trimmed = editName.trim();
    if (!trimmed) {
      setMessage("Informe um nome.");
      return;
    }

    setBusyId(walletId);
    const res = await authFetch(`/wallets/${walletId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: trimmed })
    });
    setBusyId(null);

    if (!res.ok) {
      setMessage("Nao foi possivel atualizar.");
      return;
    }

    cancelEdit();
    walletsQuery.refetch();
    setMessage("Carteira atualizada.");
  };

  const handleDelete = async (walletId: string) => {
    setMessage(null);
    if (!window.confirm("Excluir esta carteira?")) {
      return;
    }

    setBusyId(walletId);
    const res = await authFetch(`/wallets/${walletId}`, {
      method: "DELETE"
    });
    setBusyId(null);

    if (!res.ok) {
      setMessage("Nao foi possivel excluir.");
      return;
    }

    walletsQuery.refetch();
    setMessage("Carteira excluida.");
  };

  return (
    <RequireAuth>
      <AppShell>
        <div className="space-y-6 animate-rise">
          <div>
            <h1 className="text-2xl font-semibold">Gestao de Carteiras</h1>
            <p className="text-sm text-muted-foreground">Crie, edite ou remova carteiras do aplicativo.</p>
          </div>

          {!isAdmin && (
            <p className="text-sm text-muted-foreground">Apenas administradores podem gerenciar carteiras.</p>
          )}

          {isAdmin && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Nova carteira</CardTitle>
                  <CardDescription>Carteiras sao criadas pelo administrador do sistema.</CardDescription>
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

              <Card>
                <CardHeader>
                  <CardTitle>Carteiras cadastradas</CardTitle>
                  <CardDescription>Renomeie ou exclua carteiras existentes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {walletsQuery.isLoading && (
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                  )}
                  {!walletsQuery.isLoading && wallets.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma carteira cadastrada.</p>
                  )}
                  {wallets.map((entry) => {
                    const wallet = entry.wallet;
                    const isEditing = editId === wallet.id;
                    const isBusy = busyId === wallet.id;
                    return (
                      <div
                        key={wallet.id}
                        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-1">
                          {isEditing ? (
                            <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
                          ) : (
                            <p className="text-sm font-semibold text-foreground">{wallet.name}</p>
                          )}
                          <p className="text-xs text-muted-foreground">ID: {wallet.id}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {isEditing ? (
                            <>
                              <Button onClick={() => handleUpdate(wallet.id)} disabled={isBusy}>
                                Salvar
                              </Button>
                              <Button variant="outline" onClick={cancelEdit} disabled={isBusy}>
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="outline" onClick={() => startEdit(wallet.id, wallet.name)}>
                                Editar
                              </Button>
                              <Button variant="ghost" onClick={() => handleDelete(wallet.id)} disabled={isBusy}>
                                Excluir
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {walletsQuery.error && (
                    <p className="text-sm text-red-600">Nao foi possivel atualizar as carteiras.</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
