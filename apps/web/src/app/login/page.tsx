"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AccessDeniedError, useAuth } from "@/lib/auth";
import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/password-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const fallbackAdmin = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "fadomingosf@gmail.com";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
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

  return (
    <>
      <div className="fixed right-4 top-4 z-20">
        <ThemeToggle />
      </div>
      <div className="relative min-h-screen overflow-hidden bg-background px-4 py-6 md:px-6 lg:px-8">
        <div className="pointer-events-none absolute -left-20 top-16 h-56 w-56 rounded-full bg-[var(--page-gradient-1)] blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-12 h-72 w-72 rounded-full bg-[var(--page-gradient-2)] blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 top-1/2 h-56 w-56 rounded-full bg-[var(--page-gradient-3)] blur-3xl" />

        <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <Card className="hidden h-full overflow-hidden border-0 bg-[linear-gradient(135deg,rgba(95,141,255,0.96),rgba(233,104,120,0.92))] text-white shadow-[0_24px_80px_rgba(79,162,255,0.22)] lg:flex">
            <CardContent className="relative flex h-full flex-col justify-between p-8 xl:p-10">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

              <div className="space-y-6">
                <div className="inline-flex rounded-3xl border border-white/15 bg-white/12 p-3 shadow-sm backdrop-blur-sm">
                  <BrandMark className="h-14 w-auto" />
                </div>
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.45em] text-white/70">UniConta</p>
                  <h1 className="max-w-xl text-4xl font-semibold leading-tight">
                    Controle financeiro compartilhado com leitura clara e rotina simples.
                  </h1>
                  <p className="max-w-lg text-base leading-relaxed text-white/85">
                    Carteiras, transações, dívidas e relatórios em uma interface pensada para celular, com suporte ao modo
                    claro e escuro.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/15 bg-white/12 px-4 py-4 backdrop-blur-sm">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/65">Carteiras</div>
                  <div className="mt-2 text-lg font-semibold">Compartilhadas</div>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/12 px-4 py-4 backdrop-blur-sm">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/65">Sync</div>
                  <div className="mt-2 text-lg font-semibold">Offline first</div>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/12 px-4 py-4 backdrop-blur-sm">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/65">Relatorios</div>
                  <div className="mt-2 text-lg font-semibold">Visao rapida</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {accessDenied ? (
            <Card className="w-full max-w-md animate-rise lg:justify-self-end">
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
          ) : (
            <Card className="w-full max-w-md animate-rise lg:justify-self-end">
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
                    <PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} required />
                  </div>
                  <p className="text-xs text-muted-foreground">Cadastro somente pelo administrador.</p>
                  {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Processando" : "Entrar"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
