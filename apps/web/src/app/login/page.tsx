"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AccessDeniedError, useAuth } from "@/lib/auth";
import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const fallbackAdmin = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "fadomingosf@gmail.com";
  const canRegisterAdmin = email.trim().toLowerCase() === fallbackAdmin.toLowerCase();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const nextUser = await login(email, password);
      router.replace("/wallets");
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        setAccessDenied(err.adminEmail ?? fallbackAdmin);
        return;
      }
      setError("Falha ao autenticar. Verifique os dados.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminRegister = async () => {
    if (!canRegisterAdmin) return;
    setError(null);
    setLoading(true);
    try {
      const nextUser = await register(email, password);
      router.replace("/wallets");
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        setAccessDenied(err.adminEmail ?? fallbackAdmin);
        return;
      }
      setError("Falha ao registrar. Verifique os dados.");
    } finally {
      setLoading(false);
    }
  };

  if (accessDenied) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md animate-rise">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <BrandMark className="h-12 w-auto" />
              <div>
                <CardTitle className="sr-only">UniConta</CardTitle>
                <CardDescription>Acesso restrito</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Seu usuario nao tem permissao para acessar este aplicativo.</p>
            <p>Entre em contato com o administrador: <strong className="text-foreground">{accessDenied}</strong></p>
            <Button type="button" className="w-full" onClick={() => setAccessDenied(null)}>
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md animate-rise">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-center">
            <BrandMark className="h-[72px] w-auto" />
            <CardTitle className="sr-only">UniConta</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <p className="text-xs text-muted-foreground">Cadastro somente pelo administrador.</p>
            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Processando" : "Entrar"}
            </Button>
            {canRegisterAdmin && (
              <Button type="button" variant="outline" className="w-full" onClick={handleAdminRegister} disabled={loading}>
                Registrar administrador
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
