"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", path: "" },
  { label: "Transacoes", path: "/transactions" }
];

export function WalletNav({ walletId }: { walletId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto rounded-full bg-muted/70 p-1 text-sm sm:flex-wrap sm:overflow-visible">
      {navItems.map((item) => {
        const href = `/wallets/${walletId}${item.path}`;
        const active = pathname === href;
        return (
          <Link
            key={item.path}
            href={href}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 transition-colors",
              active
                ? "bg-primary text-primaryForeground shadow-sm"
                : "text-muted-foreground hover:bg-card/80"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
