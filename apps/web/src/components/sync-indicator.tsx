"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useSyncEngine } from "@/lib/sync-engine";
import { Button } from "@/components/ui/button";

export function SyncIndicator({ walletId }: { walletId: string }) {
  const { status, lastSyncAt, runSync } = useSyncEngine(walletId);
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

  return (
    <div className="flex items-center gap-3 text-xs text-gray-600">
      <span className="inline-flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${status === "error" ? "bg-red-500" : online ? "bg-emerald-500" : "bg-amber-500"}`}
        />
        {label}
      </span>
      {lastSyncAt && <span>Ultimo sync: {new Date(lastSyncAt).toLocaleTimeString()}</span>}
      <Button variant="ghost" size="sm" onClick={runSync} type="button">
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
