"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { syncCategories } from "@/lib/categories";
import { syncDebts } from "@/lib/debts";
import { useSyncEngine } from "@/lib/sync-engine";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-logo";
import { SyncIndicator } from "@/components/sync-indicator";
import { Button } from "@/components/ui/button";

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
  const { user, authFetch, logout } = useAuth();
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "fadomingosf@gmail.com";
  const isAdmin = user?.email?.toLowerCase() === adminEmail.toLowerCase();
  const hideAdminItems = Boolean(walletId);
  const syncEngine = useSyncEngine(walletId);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mobileMenuOpen]);

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

  const displayName = user?.name?.trim() || "Usuario";
  const initials = (displayName[0] ?? "U").toUpperCase();
  const footerStatus = walletId ? (
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
  );

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
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
            {footerStatus}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border bg-card px-4 py-4 md:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-foreground shadow-sm transition hover:bg-muted/70 md:hidden"
                aria-label="Abrir menu"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
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
                <span className="max-w-[140px] truncate text-sm text-foreground md:max-w-none">
                  {displayName}
                </span>
                <Button variant="outline" size="sm" onClick={logout}>
                  Sair
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 bg-background px-4 py-6 md:px-6 md:py-8">
            <div className="mx-auto w-full max-w-5xl min-w-0">{children}</div>
          </main>
        </div>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-50 flex flex-col bg-background/60 backdrop-blur-xl transition-opacity duration-300 md:hidden",
          mobileMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-hidden={!mobileMenuOpen}
        onClick={() => setMobileMenuOpen(false)}
      >
        <div
          className={cn(
            "flex h-full w-full flex-col bg-card/95 pt-6 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            mobileMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
          )}
          role="dialog"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 pb-6">
            <div className="flex items-center gap-3">
              <BrandMark className="h-9 w-auto" />
              <span className="text-base font-semibold text-foreground">Menu</span>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-foreground transition hover:bg-muted/70"
              aria-label="Fechar menu"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="grid gap-2">
              {nav.map((item) => {
                const Icon = item.icon;
                const iconElement = item.iconSrc ? (
                  <img src={item.iconSrc} alt="" aria-hidden="true" className="h-10 w-10" />
                ) : Icon ? (
                  <Icon className="h-10 w-10" />
                ) : null;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-4 rounded-2xl border border-transparent px-4 py-3 text-base font-semibold transition",
                      item.active
                        ? "border-primary/20 bg-muted text-foreground shadow-sm"
                        : "text-muted-foreground hover:border-border hover:bg-muted"
                    )}
                  >
                    {iconElement}
                    <span className="flex-1">{item.label}</span>
                    <span
                      className={cn(
                        "text-xs uppercase tracking-[0.2em]",
                        item.active ? "text-primary" : "text-muted-foreground/60"
                      )}
                    >
                      {item.active ? "Atual" : ""}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-border px-6 py-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">{footerStatus}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
