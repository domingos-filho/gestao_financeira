"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { syncCategories } from "@/lib/categories";
import { syncDebts } from "@/lib/debts";
import { useSyncEngine } from "@/lib/sync-engine";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-logo";
import { SyncIndicator } from "@/components/sync-indicator";

type NavItem = {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  iconSrc?: string;
  href?: (walletId?: string) => string | undefined;
  disabled?: boolean;
  adminOnly?: boolean;
};

type ResolvedNavItem = Omit<NavItem, "href"> & { href: string; active: boolean };

const navItems: NavItem[] = [
  {
    label: "Home",
    iconSrc: "/icons/icone%20de%20carteiras.png",
    href: () => "/wallets"
  },
  {
    label: "Dashboard",
    iconSrc: "/icons/dashboard.png",
    href: (walletId) => (walletId ? `/wallets/${walletId}` : undefined)
  },
  {
    label: "Gestao de carteiras",
    iconSrc: "/icons/carteira.png",
    href: () => "/wallets/manage",
    adminOnly: true
  },
  {
    label: "Usuarios",
    iconSrc: "/icons/usuarios.png",
    href: () => "/users",
    adminOnly: true
  },
  {
    label: "Transacoes",
    iconSrc: "/icons/transacoes.png",
    href: (walletId) => (walletId ? `/wallets/${walletId}/transactions` : undefined)
  },
  {
    label: "Dividas",
    iconSrc: "/icons/dividas.png",
    href: (walletId) => (walletId ? `/wallets/${walletId}/debts` : undefined)
  },
  {
    label: "Categorias",
    iconSrc: "/icons/categoria.png",
    href: (walletId) => (walletId ? `/wallets/${walletId}/categories` : undefined)
  },
  {
    label: "Relatorios",
    iconSrc: "/icons/relatorios.png",
    href: (walletId) => (walletId ? `/wallets/${walletId}/reports` : undefined)
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
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "fadomingosf@gmail.com";
  const isAdmin = user?.email?.toLowerCase() === adminEmail.toLowerCase();
  const hideAdminItems = Boolean(walletId);
  const syncEngine = useSyncEngine(walletId);

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

  const nav = useMemo<ResolvedNavItem[]>(
    () =>
      navItems
        .filter((item) => {
          if (item.adminOnly && hideAdminItems) {
            return false;
          }
          return !item.adminOnly || isAdmin;
        })
        .map((item) => {
          const href = item.href ? item.href(walletId) : undefined;
          if (!href || item.disabled) {
            return null;
          }
          const active =
            pathname === href || (href !== "/wallets" && pathname.startsWith(`${href}/`));
          return { ...item, href, active };
        })
        .filter((item): item is ResolvedNavItem => item !== null),
    [walletId, pathname, isAdmin, hideAdminItems]
  );

  const initials = (user?.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-r border-border bg-card px-5 py-6 md:flex">
          <Link href="/wallets" className="flex items-center gap-3 text-lg font-semibold text-primary">
            <BrandMark className="h-10 w-auto" />
            <span className="sr-only">UniConta</span>
          </Link>

          <nav className="mt-8 flex flex-1 flex-col gap-1 text-sm">
            {nav.map((item) => {
              const Icon = item.icon;
              const iconElement = item.iconSrc ? (
                <img src={item.iconSrc} alt="" aria-hidden="true" className="h-9 w-9" />
              ) : Icon ? (
                <Icon className="h-9 w-9" />
              ) : null;

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
                  {iconElement}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
            {walletId ? (
              <SyncIndicator
                status={syncEngine.status}
                lastSyncAt={syncEngine.lastSyncAt}
                runSync={syncEngine.runSync}
                compact
              />
            ) : (
              <>
                <span
                  className={`h-2 w-2 rounded-full ${
                    online ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"
                  }`}
                />
                {online ? "Online" : "Offline"}
              </>
            )}
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
            <div className="flex items-center gap-3">
              <BrandMark className="h-8 w-auto" />
              <span className="sr-only">UniConta</span>
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
                const iconElement = item.iconSrc ? (
                  <img src={item.iconSrc} alt="" aria-hidden="true" className="h-9 w-9" />
                ) : Icon ? (
                  <Icon className="h-9 w-9" />
                ) : null;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-2",
                      item.active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {iconElement}
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
