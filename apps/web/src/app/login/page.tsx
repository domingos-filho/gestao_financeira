"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
      router.replace("/wallets");
    } catch {
      setError("Falha ao autenticar. Verifique os dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent/30 blur-3xl animate-fade" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-fade animate-delay-200" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-10 py-12 lg:flex-row lg:items-stretch">
        <section className="flex w-full flex-col justify-center gap-6 lg:w-1/2 animate-rise">
          <div className="flex items-center gap-4">
            <BrandMark className="h-14 w-14 shadow-lg shadow-black/10" />
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Financeiro a dois</p>
              <h1 className="text-3xl font-semibold">Gestao Financeira</h1>
            </div>
          </div>
          <p className="max-w-md text-lg text-muted-foreground">
            Controle as financas do casal com uma visao clara, segura e pronta para funcionar mesmo offline.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Offline-first real", desc: "Registre transacoes sem internet e sincronize depois." },
              { title: "Sync automatico", desc: "Eventos idempotentes com reconciliacao segura." },
              { title: "Carteiras compartilhadas", desc: "Dois usuarios com permissoes bem definidas." },
              { title: "Design acolhedor", desc: "Informacoes essenciais sem excesso de ruido." }
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{item.title}</p>
                <p className="mt-2 text-sm text-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <Card className="w-full max-w-md border-border/70 bg-card/90 shadow-xl backdrop-blur animate-rise animate-delay-200">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Bem-vindo(a)</CardTitle>
            <CardDescription className="text-sm">Entre para continuar ou crie uma conta nova.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex rounded-full bg-muted p-1 text-sm">
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-full px-4 py-2 font-semibold transition",
                  mode === "login"
                    ? "bg-primary text-primaryForeground shadow-sm"
                    : "text-muted-foreground hover:bg-card/80"
                )}
                onClick={() => setMode("login")}
              >
                Entrar
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-full px-4 py-2 font-semibold transition",
                  mode === "register"
                    ? "bg-primary text-primaryForeground shadow-sm"
                    : "text-muted-foreground hover:bg-card/80"
                )}
                onClick={() => setMode("register")}
              >
                Criar conta
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Processando" : mode === "login" ? "Entrar" : "Registrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
