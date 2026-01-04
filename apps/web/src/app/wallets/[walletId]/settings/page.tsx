"use client";

import { useEffect, useMemo, useState } from "react";
import { WalletRole } from "@gf/shared";
import { useAuth } from "@/lib/auth";
import { getWalletRole } from "@/lib/wallet-cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const roles = [WalletRole.ADMIN, WalletRole.EDITOR, WalletRole.VIEWER];

export default function WalletSettingsPage({ params }: { params: { walletId: string } }) {
  const { walletId } = params;
  const { authFetch, user } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WalletRole>(WalletRole.EDITOR);
  const [message, setMessage] = useState<string | null>(null);
  const [accessEmail, setAccessEmail] = useState("");
  const [accessList, setAccessList] = useState<Array<{ email: string; status: "ALLOWED" | "REVOKED" }>>([]);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "fadomingosf@gmail.com";
  const isAdminEmail = user?.email?.toLowerCase() === adminEmail.toLowerCase();

  const currentRole = useMemo(() => getWalletRole(walletId), [walletId]);

  useEffect(() => {
    if (!isAdminEmail) return;
    let active = true;

    const loadAccess = async () => {
      const res = await authFetch("/users/access");
      if (!res.ok) return;
      const data = (await res.json()) as Array<{ email: string; status: "ALLOWED" | "REVOKED" }>;
      if (active) {
        setAccessList(data);
      }
    };

    loadAccess();

    return () => {
      active = false;
    };
  }, [authFetch, isAdminEmail]);

  const handleAddMember = async () => {
    setMessage(null);
    const res = await authFetch(`/wallets/${walletId}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role })
    });

    if (res.ok) {
      setEmail("");
      setMessage("Membro adicionado.");
    } else {
      setMessage("Nao foi possivel adicionar.");
    }
  };

  const handleGrantAccess = async (targetEmail?: string) => {
    setAccessMessage(null);
    const emailValue = (targetEmail ?? accessEmail).trim();
    if (!emailValue) {
      setAccessMessage("Informe um email.");
      return;
    }
    const res = await authFetch("/users/access", {
      method: "POST",
      body: JSON.stringify({ email: emailValue })
    });

    if (res.ok) {
      setAccessEmail("");
      setAccessMessage("Usuario liberado.");
      const data = (await res.json()) as { email: string; status: "ALLOWED" | "REVOKED" };
      setAccessList((prev) => {
        const next = prev.filter((item) => item.email !== data.email);
        return [data, ...next];
      });
    } else {
      setAccessMessage("Nao foi possivel liberar.");
    }
  };

  const handleRevokeAccess = async (targetEmail: string) => {
    setAccessMessage(null);
    const res = await authFetch(`/users/access/${encodeURIComponent(targetEmail)}`, {
      method: "DELETE"
    });

    if (res.ok) {
      setAccessMessage("Acesso removido.");
      setAccessList((prev) =>
        prev.map((item) => (item.email === targetEmail ? { ...item, status: "REVOKED" } : item))
      );
    } else {
      setAccessMessage("Nao foi possivel remover.");
    }
  };

  if (currentRole !== WalletRole.ADMIN && !isAdminEmail) {
    return <p className="text-sm text-muted-foreground">Apenas administradores podem gerenciar usuarios.</p>;
  }

  return (
    <div className="grid gap-6 animate-rise">
      <div>
        <h2 className="text-2xl font-semibold">Gerenciamento de Usuarios</h2>
        <p className="text-sm text-muted-foreground">Controle acessos e membros da carteira</p>
      </div>

      {isAdminEmail && (
        <Card>
          <CardHeader>
            <CardTitle>Acesso ao Aplicativo</CardTitle>
            <CardDescription>Somente emails liberados podem entrar no sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="w-full space-y-2 md:flex-1">
                <Label>Email</Label>
                <Input value={accessEmail} onChange={(event) => setAccessEmail(event.target.value)} />
              </div>
              <Button onClick={handleGrantAccess}>Liberar acesso</Button>
            </div>
            {accessMessage && <p className="text-sm text-muted-foreground">{accessMessage}</p>}

            <div className="space-y-3">
              {accessList.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum acesso adicional liberado.</p>
              )}
              {accessList.map((item) => (
                <div
                  key={item.email}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{item.email}</p>
                    <p className="text-xs text-muted-foreground">{item.status === "ALLOWED" ? "Liberado" : "Revogado"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status === "ALLOWED" ? (
                      <Button variant="outline" onClick={() => handleRevokeAccess(item.email)}>
                        Revogar
                      </Button>
                    ) : (
                      <Button onClick={() => handleGrantAccess(item.email)}>Reativar</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {currentRole === WalletRole.ADMIN && (
        <Card>
          <CardHeader>
            <CardTitle>Membros da Carteira</CardTitle>
            <CardDescription>Compartilhe esta carteira com outros usuarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Papel</Label>
                <Select value={role} onValueChange={(value) => setRole(value as WalletRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            <Button onClick={handleAddMember}>Adicionar membro</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
