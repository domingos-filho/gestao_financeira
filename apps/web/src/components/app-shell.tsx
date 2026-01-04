"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  CreditCard,
  Folder,
  LayoutGrid,
  Search,
  ArrowLeftRight,
  Users
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { syncCategories } from "@/lib/categories";
import { syncDebts } from "@/lib/debts";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-logo";
import { SyncIndicator } from "@/components/sync-indicator";

type NavItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  href?: (walletId?: string) => string | undefined;
  disabled?: boolean;
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    icon: LayoutGrid,
    href: (walletId) => (walletId ? `/wallets/${walletId}` : "/wallets")
  },
  {
    label: "Transacoes",
    icon: ArrowLeftRight,
    href: (walletId) => (walletId ? `/wallets/${walletId}/transactions` : undefined)
  },
  {
    label: "Dividas",
    icon: CreditCard,
    href: (walletId) => (walletId ? `/wallets/${walletId}/debts` : undefined)
  },
  {
    label: "Categorias",
    icon: Folder,
    href: (walletId) => (walletId ? `/wallets/${walletId}/categories` : undefined)
  },
  {
    label: "Relatorios",
    icon: BarChart3,
    href: (walletId) => (walletId ? `/wallets/${walletId}/reports` : undefined)
  },
  {
    label: "Usuarios",
    icon: Users,
    href: (walletId) => (walletId ? `/wallets/${walletId}/settings` : undefined)
  }
];

type AppShellProps = {
  children: React.ReactNode;
  walletId?: string;
};

export function AppShell({ children, walletId }: AppShellProps) {
  const pathname = usePathname();
  const { user, authFetch } = useAuth();
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!walletId || !user || !navigator.onLine) {
      return;
    }
    syncCategories(walletId, authFetch).catch(() => null);
    syncDebts(walletId, authFetch).catch(() => null);
  }, [walletId, user, authFetch]);

  const nav = useMemo(
    () =>
      navItems.map((item) => {
        const href = item.href ? item.href(walletId) : undefined;
        const active = Boolean(
          href &&
            (pathname === href || (href !== "/wallets" && pathname.startsWith(`${href}/`)))
        );
        return { ...item, href, active };
      }),
    [walletId, pathname]
  );

  const initials = user?.email ? user.email[0].toUpperCase() : "U";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-r border-border bg-card px-5 py-6 md:flex">
          <Link href="/wallets" className="flex items-center gap-3 text-lg font-semibold text-primary">
            <BrandMark variant="outline" />
            FinanceFlow
          </Link>

          <nav className="mt-8 flex flex-1 flex-col gap-1 text-sm">
            {nav.map((item) => {
              const Icon = item.icon;
              if (item.disabled || !item.href) {
                return (
                  <div
                    key={item.label}
                    className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground opacity-60"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </div>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 transition",
                    item.active
                      ? "bg-muted text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
            {walletId ? (
              <SyncIndicator walletId={walletId} compact />
            ) : (
              <>
                <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`} />
                {online ? "Online" : "Offline"}
              </>
            )}
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
            <div className="flex items-center gap-3">
              <BrandMark variant="outline" className="md:hidden" />
              <span className="text-lg font-semibold text-primary md:hidden">FinanceFlow</span>
              <span className="hidden text-lg font-semibold text-primary md:inline">FinanceFlow</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <button type="button" className="rounded-full p-2 hover:bg-muted" aria-label="Pesquisar">
                <Search className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-full p-2 hover:bg-muted" aria-label="Notificacoes">
                <Bell className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {initials}
                </span>
                <span className="hidden text-sm text-foreground md:inline">{user?.email ?? "usuario@exemplo.com"}</span>
              </div>
            </div>
          </header>

          <div className="border-b border-border bg-card px-4 py-3 md:hidden">
            <nav className="flex items-center gap-2 overflow-x-auto text-xs">
              {nav.map((item) => {
                const Icon = item.icon;
                if (item.disabled || !item.href) {
                  return (
                    <div
                      key={item.label}
                      className="flex cursor-not-allowed items-center gap-2 rounded-full px-3 py-2 text-muted-foreground opacity-60"
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </div>
                  );
                }
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-2",
                      item.active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <main className="flex-1 bg-background px-6 py-8">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
