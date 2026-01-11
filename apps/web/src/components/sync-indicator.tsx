"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { SyncStatus } from "@/lib/sync-engine";
import { parseDate } from "@/lib/date";
import { Button } from "@/components/ui/button";

type SyncIndicatorProps = {
  status: SyncStatus;
  lastSyncAt: string | null;
  runSync: () => void;
  compact?: boolean;
};

export function SyncIndicator({ status, lastSyncAt, runSync, compact = false }: SyncIndicatorProps) {
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

  const label = useMemo(() => {
    if (status === "syncing") return "Sincronizando";
    if (status === "error") return "Erro de sync";
    return online ? "Online" : "Offline";
  }, [status, online]);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={`h-2 w-2 rounded-full ${status === "error" ? "bg-[var(--color-danger)]" : online ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"}`}
        />
        {label}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1">
        <span
          className={`h-2 w-2 rounded-full ${status === "error" ? "bg-[var(--color-danger)]" : online ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"}`}
        />
        {label}
      </span>
      {lastSyncAt && (
        <span>
          Ultimo sync:{" "}
          {(() => {
            const parsed = parseDate(lastSyncAt);
            return parsed ? parsed.toLocaleTimeString() : "-";
          })()}
        </span>
      )}
      <Button variant="ghost" size="sm" onClick={runSync} type="button">
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
