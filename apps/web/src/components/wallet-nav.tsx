"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", path: "" },
  { label: "Transacoes", path: "/transactions" },
  { label: "Configuracao", path: "/settings" }
];

export function WalletNav({ walletId }: { walletId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 text-sm">
      {navItems.map((item) => {
        const href = `/wallets/${walletId}${item.path}`;
        const active = pathname === href;
        return (
          <Link
            key={item.path}
            href={href}
            className={cn(
              "rounded-full px-4 py-2 transition-colors",
              active ? "bg-primary text-primaryForeground" : "hover:bg-muted"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
