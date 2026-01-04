"use client";

import { useMemo, useState } from "react";
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
  const { authFetch } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WalletRole>(WalletRole.EDITOR);
  const [message, setMessage] = useState<string | null>(null);

  const currentRole = useMemo(() => getWalletRole(walletId), [walletId]);

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

  if (currentRole !== WalletRole.ADMIN) {
    return <p className="text-sm text-muted-foreground">Apenas administradores podem gerenciar membros.</p>;
  }

  return (
    <Card className="border-border/60 bg-card/85">
      <CardHeader>
        <CardTitle>Configuracao da carteira</CardTitle>
        <CardDescription>Adicionar membros e definir papeis.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <Button onClick={handleAddMember}>Adicionar membro</Button>
      </CardContent>
    </Card>
  );
}
