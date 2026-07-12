"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth";
import { getDeviceId } from "./device";
import { getLastSyncAt, getLastSyncResult, syncNow, type SyncOutcome } from "./sync";

export type SyncStatus = "idle" | "syncing" | "error";

export function useSyncEngine(walletId?: string) {
  const { user, authFetch } = useAuth();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncOutcome | null>(null);
  const syncingRef = useRef(false);
  const walletRef = useRef(walletId);
  const userRef = useRef(user);
  const authFetchRef = useRef(authFetch);

  useEffect(() => {
    walletRef.current = walletId;
  }, [walletId]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    authFetchRef.current = authFetch;
  }, [authFetch]);

  useEffect(() => {
    let cancelled = false;

    if (!walletId) {
      setStatus("idle");
      setLastSyncAt(null);
      setLastSyncResult(null);
      return () => {
        cancelled = true;
      };
    }

    setStatus("idle");
    setLastSyncAt(null);
    setLastSyncResult(null);

    void (async () => {
      const [latestAt, latestResult] = await Promise.all([
        getLastSyncAt(walletId),
        getLastSyncResult(walletId)
      ]);

      if (cancelled) {
        return;
      }

      setLastSyncAt(latestAt);
      setLastSyncResult(latestResult ?? (latestAt ? "success" : null));
    })();

    return () => {
      cancelled = true;
    };
  }, [walletId]);

  const runSync = useCallback(async () => {
    const activeWalletId = walletRef.current;
    const activeUser = userRef.current;
    const activeAuthFetch = authFetchRef.current;

    if (!activeWalletId || !activeUser) {
      return;
    }

    if (!navigator.onLine) {
      return;
    }

    if (syncingRef.current) {
      return;
    }
    syncingRef.current = true;
    setStatus("syncing");
    try {
      await syncNow({
        walletId: activeWalletId,
        userId: activeUser.id,
        deviceId: getDeviceId(),
        authFetch: activeAuthFetch
      });
      const [latestAt, latestResult] = await Promise.all([
        getLastSyncAt(activeWalletId),
        getLastSyncResult(activeWalletId)
      ]);
      setLastSyncAt(latestAt);
      setLastSyncResult(latestResult ?? (latestAt ? "success" : null));
      setStatus("idle");
    } catch {
      const failedAt = new Date().toISOString();
      setLastSyncAt(failedAt);
      setLastSyncResult("error");
      setStatus("error");
    } finally {
      syncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!walletId || !user?.id) {
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
  }, [walletId, user?.id, runSync]);

  return { status, lastSyncAt, lastSyncResult, runSync };
}
