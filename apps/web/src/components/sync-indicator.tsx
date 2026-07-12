"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import type { SyncOutcome } from "@/lib/sync";
import type { SyncStatus } from "@/lib/sync-engine";
import { parseDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type SyncIndicatorProps = {
  status: SyncStatus;
  lastSyncAt: string | null;
  lastSyncResult?: SyncOutcome | null;
  runSync: () => void;
  compact?: boolean;
};

export function SyncIndicator({
  status,
  lastSyncAt,
  lastSyncResult,
  runSync,
  compact = false
}: SyncIndicatorProps) {
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

  const syncResult = lastSyncResult ?? (lastSyncAt ? "success" : null);
  const formattedLastSyncAt = useMemo(() => {
    const parsed = parseDate(lastSyncAt ?? undefined);
    if (!parsed) {
      return null;
    }
    return parsed.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    });
  }, [lastSyncAt]);

  const resultIcon = useMemo(() => {
    if (syncResult === "success") {
      return <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" aria-hidden="true" />;
    }
    if (syncResult === "error") {
      return <AlertCircle className="h-3.5 w-3.5 text-[var(--color-danger)]" aria-hidden="true" />;
    }
    return null;
  }, [syncResult]);

  if (compact) {
    return (
      <div className="flex flex-col items-start gap-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${status === "error" ? "bg-[var(--color-danger)]" : online ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"}`}
          />
          {label}
        </div>
        {formattedLastSyncAt && (
          <div className="flex items-center gap-1.5 leading-tight">
            <span data-sync-result={syncResult ?? "none"} className="inline-flex items-center">
              {resultIcon}
            </span>
            <span>Ultima sincronizacao: {formattedLastSyncAt}</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void runSync();
          }}
          type="button"
          disabled={status === "syncing"}
          aria-label="Sincronizar"
          className="-ml-2 h-7 px-2 text-xs"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", status === "syncing" && "animate-spin")} />
          Sincronizar
        </Button>
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
      {formattedLastSyncAt && (
        <span className="inline-flex items-center gap-1.5">
          <span data-sync-result={syncResult ?? "none"} className="inline-flex items-center">
            {resultIcon}
          </span>
          <span>Ultima sincronizacao: {formattedLastSyncAt}</span>
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void runSync();
        }}
        type="button"
        disabled={status === "syncing"}
      >
        <span className="sr-only">Sincronizar</span>
        <RefreshCw className={cn("h-3.5 w-3.5", status === "syncing" && "animate-spin")} />
      </Button>
    </div>
  );
}
