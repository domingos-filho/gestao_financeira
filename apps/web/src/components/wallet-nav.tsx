"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, LayoutDashboard } from "lucide-react";
import { isRouteActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", path: "", icon: LayoutDashboard },
  { label: "Transacoes", path: "/transactions", icon: ArrowLeftRight }
];

export function WalletNav({ walletId }: { walletId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto rounded-full bg-muted/70 p-1 text-sm sm:flex-wrap sm:overflow-visible">
      {navItems.map((item) => {
        const href = `/wallets/${walletId}${item.path}`;
        const active = isRouteActive(pathname, href);
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 transition-colors",
              active
                ? "bg-primary text-primaryForeground shadow-sm"
                : "text-muted-foreground hover:bg-card/80"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
