"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@gf/shared";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WalletOption = { id: string; name: string };

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  defaultWallet: WalletOption | null;
};

type WalletSelectProps = {
  value: string;
  onChange: (value: string) => void;
  wallets: WalletOption[];
  disabled?: boolean;
};

function WalletSelect({ value, onChange, wallets, disabled }: WalletSelectProps) {
  const isEmpty = wallets.length === 0;

  return (
    <div className="relative">
      <select
        className="flex h-10 w-full appearance-none items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || isEmpty}
      >
        {isEmpty ? (
          <option value="" disabled>
            Nenhuma carteira cadastrada
          </option>
        ) : (
          <>
            <option value="" disabled>
              Selecione uma carteira
            </option>
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name}
              </option>
            ))}
          </>
        )}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export default function UsersPage() {
  const router = useRouter();
  const { authFetch, user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editWalletId, setEditWalletId] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [walletId, setWalletId] = useState("");

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "fadomingosf@gmail.com";
  const isAdmin = user?.email?.toLowerCase() === adminEmail.toLowerCase();
  const adminEmailNormalized = useMemo(() => adminEmail.toLowerCase(), [adminEmail]);

  useEffect(() => {
    if (!authLoading && user && !isAdmin) {
      router.replace("/wallets");
    }
  }, [authLoading, user, isAdmin, router]);

  const loadData = async () => {
    setDataLoading(true);
    try {
      const usersRes = await authFetch("/users");
      if (usersRes.ok) {
        const data = (await usersRes.json()) as ManagedUser[];
        setUsers(data);
      } else {
        setMessage("Nao foi possivel carregar usuarios.");
      }

      const walletSources = ["/wallets/admin", "/users/wallet-options", "/wallets"];
      let walletsLoaded = false;

      for (const path of walletSources) {
        const res = await authFetch(path);
        if (!res.ok) {
          continue;
        }

        if (path === "/wallets") {
          const data = (await res.json()) as Array<{ wallet: WalletOption }>;
          setWallets(
            data.map((entry) => ({
              id: entry.wallet.id,
              name: entry.wallet.name
            }))
          );
        } else {
          const data = (await res.json()) as Array<{ id: string; name: string }>;
          setWallets(data.map((wallet) => ({ id: wallet.id, name: wallet.name })));
        }

        walletsLoaded = true;
        break;
      }

      if (!walletsLoaded) {
        setMessage("Nao foi possivel carregar carteiras.");
      }
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin, authFetch]);

  useEffect(() => {
    if (wallets.length === 0) {
      setWalletId("");
      if (editId) {
        setEditWalletId("");
      }
      return;
    }

    setWalletId((current) => {
      if (current && wallets.some((item) => item.id === current)) {
        return current;
      }
      return "";
    });

    if (editId) {
      setEditWalletId((current) => {
        if (current && wallets.some((item) => item.id === current)) {
          return current;
        }
        return "";
      });
    }
  }, [wallets, editId]);

  const handleCreate = async () => {
    setMessage(null);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password || !walletId) {
      setMessage("Preencha todos os campos.");
      return;
    }
    if (password.length < 6) {
      setMessage("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    const res = await authFetch("/users", {
      method: "POST",
      body: JSON.stringify({
        name: trimmedName,
        email: trimmedEmail,
        password,
        role: UserRole.MEMBER,
        walletId
      })
    });

    if (!res.ok) {
      setMessage("Nao foi possivel criar o usuario.");
      return;
    }

    setName("");
    setEmail("");
    setPassword("");
    setWalletId("");
    setMessage("Usuario criado.");
    loadData();
  };

  const startEdit = (item: ManagedUser) => {
    setEditId(item.id);
    setEditName(item.name);
    setEditWalletId(item.defaultWallet?.id ?? "");
    setEditPassword("");
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
    setEditWalletId("");
    setEditPassword("");
  };

  const handleUpdate = async () => {
    if (!editId) return;
    setMessage(null);
    if (!editName.trim()) {
      setMessage("Informe um nome.");
      return;
    }

    const payload: {
      name?: string;
      walletId?: string;
      password?: string;
    } = {
      name: editName.trim()
    };

    if (editWalletId) {
      payload.walletId = editWalletId;
    }

    if (editPassword.trim()) {
      payload.password = editPassword;
    }

    const res = await authFetch(`/users/${editId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      setMessage("Nao foi possivel atualizar o usuario.");
      return;
    }

    setMessage("Usuario atualizado.");
    cancelEdit();
    loadData();
  };

  const handleDelete = async (targetId: string) => {
    if (!window.confirm("Excluir este usuario?")) {
      return;
    }
    setMessage(null);
    setBusyId(targetId);
    const res = await authFetch(`/users/${targetId}`, { method: "DELETE" });
    setBusyId(null);

    if (!res.ok) {
      setMessage("Nao foi possivel excluir o usuario.");
      return;
    }

    setMessage("Usuario excluido.");
    loadData();
  };

  if (user && !isAdmin) {
    return null;
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="space-y-6 animate-rise">
          <div>
            <h1 className="text-2xl font-semibold">Gestao de Usuarios</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre usuarios, defina perfil e associe a carteira principal.
            </p>
          </div>

          {isAdmin && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Novo usuario</CardTitle>
                  <CardDescription>Usuarios criados aqui ja podem acessar o aplicativo.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={name} onChange={(event) => setName(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha</Label>
                    <Input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type="password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Perfil</Label>
                    <Input value="Membro" readOnly />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Carteira principal</Label>
                    <WalletSelect value={walletId} onChange={setWalletId} wallets={wallets} disabled={dataLoading} />
                    {wallets.length === 0 && (
                      <p className="text-xs text-muted-foreground">Cadastre uma carteira antes de criar usuarios.</p>
                    )}
                  </div>
                  <Button variant="create" onClick={handleCreate} disabled={dataLoading || wallets.length === 0}>
                    Criar usuario
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Usuarios cadastrados</CardTitle>
                  <CardDescription>Atualize perfil, senha ou carteira principal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dataLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
                  {!dataLoading && users.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum usuario cadastrado.</p>
                  )}
                  {users.map((item) => {
                    const isEditing = editId === item.id;
                    const isBusy = busyId === item.id;
                    const isProtected =
                      item.email.toLowerCase() === adminEmailNormalized || item.id === user?.id;
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="grid flex-1 gap-3 md:grid-cols-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Nome</Label>
                            {isEditing ? (
                              <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
                            ) : (
                              <p className="text-sm text-muted-foreground">{item.name || "Sem nome"}</p>
                            )}
                            <p className="text-xs text-muted-foreground">{item.email}</p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Perfil</Label>
                            <p className="text-sm text-muted-foreground">
                              {item.role === UserRole.ADMIN ? "Admin" : "Membro"}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Carteira</Label>
                            {isEditing ? (
                              <WalletSelect
                                value={editWalletId}
                                onChange={setEditWalletId}
                                wallets={wallets}
                                disabled={isBusy}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {item.defaultWallet?.name ?? "Sem carteira"}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Senha</Label>
                            {isEditing ? (
                              <Input
                                value={editPassword}
                                onChange={(event) => setEditPassword(event.target.value)}
                                type="password"
                                placeholder="Nova senha"
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground">********</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {isEditing ? (
                            <>
                              <Button variant="edit" onClick={handleUpdate} disabled={isBusy}>
                                Salvar
                              </Button>
                              <Button variant="outline" onClick={cancelEdit} disabled={isBusy}>
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="edit" onClick={() => startEdit(item)} disabled={isBusy}>
                                Editar
                              </Button>
                              <Button
                                variant="delete"
                                onClick={() => handleDelete(item.id)}
                                disabled={isBusy || isProtected}
                              >
                                Excluir
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
