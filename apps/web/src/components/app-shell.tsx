"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, RefreshCw, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { syncCategories } from "@/lib/categories";
import { syncDebts } from "@/lib/debts";
import { getDeviceId } from "@/lib/device";
import { useSyncEngine } from "@/lib/sync-engine";
import { ensureCurrentMonthRecurringTransactions, syncNow } from "@/lib/sync";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-logo";
import { SyncIndicator } from "@/components/sync-indicator";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  iconSrc?: string;
  href?: (walletId?: string) => string | undefined;
  disabled?: boolean;
  adminOnly?: boolean;
};

type ResolvedNavItem = Omit<NavItem, "href"> & { href: string; active: boolean };

function renderNavIcon(item: Pick<NavItem, "icon" | "iconSrc">, className: string) {
  const Icon = item.icon;

  if (item.iconSrc) {
    return (
      <Image
        src={item.iconSrc}
        alt=""
        aria-hidden="true"
        width={item.iconSrc === "/icons/dashboard.png" ? 920 : 500}
        height={item.iconSrc === "/icons/dashboard.png" ? 704 : 500}
        unoptimized
        className={className}
      />
    );
  }

  if (Icon) {
    return <Icon className={className} />;
  }

  return null;
}

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
  syncWalletIds?: string[];
};

export function AppShell({ children, walletId, syncWalletIds }: AppShellProps) {
  const pathname = usePathname();
  const { user, authFetch, logout } = useAuth();
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "fadomingosf@gmail.com";
  const isAdmin = user?.email?.toLowerCase() === adminEmail.toLowerCase();
  const hideAdminItems = Boolean(walletId);
  const syncEngine = useSyncEngine(walletId);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

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

  const syncVisibleWallets = useCallback(async () => {
    if (!user || !navigator.onLine) {
      return;
    }

    const targets = syncWalletIds ?? [];
    if (targets.length === 0) {
      return;
    }

    for (const targetWalletId of targets) {
      try {
        await syncNow({
          walletId: targetWalletId,
          userId: user.id,
          deviceId: getDeviceId(),
          authFetch
        });
      } catch (error) {
        console.error("Sync failed", {
          walletId: targetWalletId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }, [authFetch, syncWalletIds, user]);

  useEffect(() => {
    if (!walletId || !user) {
      return;
    }
    ensureCurrentMonthRecurringTransactions({
      walletId,
      userId: user.id,
      deviceId: getDeviceId()
    }).catch(() => null);
  }, [walletId, user]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
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

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    };
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (userMenuRef.current && target && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [userMenuOpen]);

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
  const mobileQuickNav = nav.slice(0, 3);

  const displayName = user?.name?.trim() || "Usuario";
  const initials = (displayName[0] ?? "U").toUpperCase();
  const syncDisabled = !user || (!walletId && (syncWalletIds?.length ?? 0) === 0);
  const handleSync = walletId ? syncEngine.runSync : syncVisibleWallets;
  const footerStatus = walletId ? (
    <SyncIndicator
      status={syncEngine.status}
      lastSyncAt={syncEngine.lastSyncAt}
      runSync={handleSync}
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
        <aside className="hidden w-72 flex-col border-r border-border/70 bg-card/85 px-4 py-5 shadow-[8px_0_30px_rgba(15,23,42,0.04)] backdrop-blur-xl md:flex">
          <Link
            href="/wallets"
            className="flex items-center gap-3 rounded-3xl border border-border/70 bg-muted/40 px-3 py-2 text-lg font-semibold text-primary shadow-sm transition hover:bg-muted/70"
          >
            <BrandMark className="h-10 w-auto" />
            <span className="sr-only">UniConta</span>
          </Link>

          <nav className="mt-8 flex flex-1 flex-col gap-1 text-sm">
            {nav.map((item) => {
              const iconElement = renderNavIcon(item, "h-8 w-8 object-contain");

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-3 transition",
                    item.active
                      ? "bg-muted/80 text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  {iconElement}
                  {item.label}
                </Link>
              );
            })}

            <button
              type="button"
              onClick={handleSync}
              disabled={syncDisabled}
              className={cn(
                "mt-2 flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition",
                syncDisabled
                  ? "cursor-not-allowed text-muted-foreground/50"
                  : "bg-[linear-gradient(135deg,rgba(95,141,255,0.12),rgba(239,111,125,0.14))] text-muted-foreground hover:text-foreground"
              )}
            >
              <RefreshCw className="h-6 w-6" />
              Sincronizar
            </button>
          </nav>

          <div className="mt-auto rounded-2xl border border-border/70 bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">{footerStatus}</div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="relative z-40 flex items-center justify-between border-b border-border/70 bg-card/80 px-4 py-4 backdrop-blur-xl md:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-muted/60 text-foreground shadow-sm transition hover:bg-muted/80 md:hidden"
                aria-label="Abrir menu"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <BrandMark className="h-10 w-auto md:h-11" />
              <span className="sr-only">UniConta</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <ThemeToggle />
              <div className="relative z-50" ref={userMenuRef}>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#4fa2ff,#e96878)] text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  aria-label="Abrir menu do usuario"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                >
                  {initials}
                </button>
                <div
                  className={cn(
                    "absolute right-0 mt-3 w-48 origin-top-right rounded-xl border border-border bg-card p-3 text-sm shadow-lg transition z-50",
                    userMenuOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
                  )}
                >
                  <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                  <Button variant="outline" size="sm" onClick={logout} className="mt-3 w-full">
                    Sair
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 bg-background px-4 py-6 pb-28 md:px-6 md:py-8 md:pb-8">
            <div className="mx-auto w-full max-w-6xl min-w-0">{children}</div>
          </main>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/90 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5 gap-1 px-3 py-2">
          {mobileQuickNav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold transition",
                item.active
                  ? "bg-muted/80 text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              {renderNavIcon(item, "h-5 w-5 object-contain")}
              <span className="w-full truncate text-center leading-none">{item.label}</span>
            </Link>
          ))}

          <button
            type="button"
            onClick={() => {
              handleSync();
            }}
            disabled={syncDisabled}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold transition",
              syncDisabled
                ? "cursor-not-allowed text-muted-foreground/40"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            <RefreshCw className="h-5 w-5" />
            <span className="w-full truncate text-center leading-none">Sincronizar</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
            <span className="w-full truncate text-center leading-none">Mais</span>
          </button>
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
            "mt-auto max-h-[86vh] w-full rounded-t-[2rem] border border-border/70 bg-card/95 px-4 pb-4 pt-3 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            mobileMenuOpen ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
          )}
          role="dialog"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border/70" />
          <div className="flex items-center justify-between px-1 pb-4">
            <div className="flex items-center gap-3">
              <BrandMark className="h-9 w-auto" />
              <span className="text-base font-semibold text-foreground">Menu</span>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-muted/60 text-foreground transition hover:bg-muted/80"
              aria-label="Fechar menu"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="max-h-[52vh] overflow-y-auto pr-1">
            <div className="grid gap-2">
              {nav.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-4 rounded-2xl border border-transparent px-4 py-3 text-base font-semibold transition",
                    item.active
                      ? "border-primary/15 bg-muted/80 text-foreground shadow-sm"
                      : "bg-muted/35 text-muted-foreground hover:border-border/70 hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background/80">
                    {renderNavIcon(item, "h-6 w-6 object-contain")}
                  </span>
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
              ))}

              <button
                type="button"
                onClick={() => {
                  handleSync();
                  setMobileMenuOpen(false);
                }}
                disabled={syncDisabled}
                className={cn(
                  "mt-2 flex items-center gap-4 rounded-2xl border px-4 py-3 text-base font-semibold transition",
                  syncDisabled
                    ? "cursor-not-allowed border-transparent text-muted-foreground/40"
                    : "border-transparent bg-[linear-gradient(135deg,rgba(95,141,255,0.14),rgba(239,111,125,0.14))] text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background/80">
                  <RefreshCw className="h-6 w-6" />
                </span>
                <span className="flex-1">Sincronizar</span>
              </button>
            </div>
          </nav>

          <div className="mt-4 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">{footerStatus}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
