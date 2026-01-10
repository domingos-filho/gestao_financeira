"use client";

import { useEffect, useState } from "react";
import { UserRole } from "@gf/shared";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type WalletOption = { id: string; name: string };
type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  defaultWallet: WalletOption | null;
};

const roleOptions = [
  { value: UserRole.ADMIN, label: "Admin" },
  { value: UserRole.MEMBER, label: "Membro" }
];

export default function UsersPage() {
  const { authFetch, user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>(UserRole.MEMBER);
  const [editWalletId, setEditWalletId] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.MEMBER);
  const [walletId, setWalletId] = useState("");

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "fadomingosf@gmail.com";
  const isAdmin =
    user?.role === UserRole.ADMIN || user?.email?.toLowerCase() === adminEmail.toLowerCase();

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, walletsRes] = await Promise.all([
        authFetch("/users"),
        authFetch("/wallets/admin")
      ]);

      if (usersRes.ok) {
        const data = (await usersRes.json()) as ManagedUser[];
        setUsers(data);
      } else {
        setMessage("Nao foi possivel carregar usuarios.");
      }

      if (walletsRes.ok) {
        const data = (await walletsRes.json()) as WalletOption[];
        setWallets(data);
        if (!walletId && data[0]) {
          setWalletId(data[0].id);
        }
      } else {
        setMessage("Nao foi possivel carregar carteiras.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin, authFetch]);

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
        role,
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
    setRole(UserRole.MEMBER);
    setMessage("Usuario criado.");
    loadData();
  };

  const startEdit = (item: ManagedUser) => {
    setEditId(item.id);
    setEditName(item.name);
    setEditRole(item.role);
    setEditWalletId(item.defaultWallet?.id ?? "");
    setEditPassword("");
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
    setEditRole(UserRole.MEMBER);
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
      role?: UserRole;
      walletId?: string;
      password?: string;
    } = {
      name: editName.trim(),
      role: editRole
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

          {!isAdmin && (
            <p className="text-sm text-muted-foreground">
              Apenas administradores podem gerenciar usuarios.
            </p>
          )}

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
                    <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Carteira principal</Label>
                    <Select value={walletId} onValueChange={setWalletId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma carteira" />
                      </SelectTrigger>
                      <SelectContent>
                        {wallets.map((wallet) => (
                          <SelectItem key={wallet.id} value={wallet.id}>
                            {wallet.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {wallets.length === 0 && (
                      <p className="text-xs text-muted-foreground">Cadastre uma carteira antes de criar usuarios.</p>
                    )}
                  </div>
                  <Button onClick={handleCreate} disabled={loading || wallets.length === 0}>
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
                  {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
                  {!loading && users.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum usuario cadastrado.</p>
                  )}
                  {users.map((item) => {
                    const isEditing = editId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-2 md:min-w-[240px]">
                          {isEditing ? (
                            <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
                          ) : (
                            <p className="text-sm font-semibold text-foreground">{item.name}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{item.email}</p>
                        </div>
                        <div className="grid flex-1 gap-3 md:grid-cols-3">
                          <div className="space-y-2">
                            <Label className="text-xs">Perfil</Label>
                            {isEditing ? (
                              <Select value={editRole} onValueChange={(value) => setEditRole(value as UserRole)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  {roleOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {item.role === UserRole.ADMIN ? "Admin" : "Membro"}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Carteira</Label>
                            {isEditing ? (
                              <Select value={editWalletId} onValueChange={setEditWalletId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  {wallets.map((wallet) => (
                                    <SelectItem key={wallet.id} value={wallet.id}>
                                      {wallet.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
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
                              <Button onClick={handleUpdate}>Salvar</Button>
                              <Button variant="outline" onClick={cancelEdit}>
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" onClick={() => startEdit(item)}>
                              Editar
                            </Button>
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
