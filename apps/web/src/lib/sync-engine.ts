"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth";
import { getDeviceId } from "./device";
import { getLastSyncAt, syncNow } from "./sync";

export type SyncStatus = "idle" | "syncing" | "error";

export function useSyncEngine(walletId?: string) {
  const { user, authFetch } = useAuth();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const runSync = useCallback(async () => {
    if (!walletId || !user) {
      return;
    }

    if (!navigator.onLine) {
      return;
    }

    setStatus("syncing");
    try {
      await syncNow({
        walletId,
        userId: user.id,
        deviceId: getDeviceId(),
        authFetch
      });
      const latest = await getLastSyncAt(walletId);
      setLastSyncAt(latest);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [walletId, user, authFetch]);

  useEffect(() => {
    if (!walletId || !user) {
      return;
    }

    runSync();

    const interval = window.setInterval(runSync, 30000);
    const handleOnline = () => runSync();
    window.addEventListener("online", handleOnline);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
    };
  }, [walletId, user, runSync]);

  return { status, lastSyncAt, runSync };
}
