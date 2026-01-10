"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getDeviceId } from "./device";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const STORAGE_KEY = "gf.auth";

type AuthUser = { id: string; email: string };

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  authFetch: (path: string, options?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export class AccessDeniedError extends Error {
  adminEmail?: string;
  constructor(adminEmail?: string) {
    super("ACCESS_DENIED");
    this.adminEmail = adminEmail;
  }
}

async function parseErrorPayload(response: Response) {
  try {
    return (await response.json()) as {
      code?: string;
      adminEmail?: string;
      message?: unknown;
    };
  } catch {
    return null;
  }
}

function loadStoredAuth(): Omit<AuthState, "loading"> {
  if (typeof window === "undefined") {
    return { user: null, accessToken: null, refreshToken: null };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { user: null, accessToken: null, refreshToken: null };
  }

  try {
    const parsed = JSON.parse(raw) as { user: AuthUser; accessToken: string; refreshToken: string };
    return {
      user: parsed.user ?? null,
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null
    };
  } catch {
    return { user: null, accessToken: null, refreshToken: null };
  }
}

function persistAuth(state: Omit<AuthState, "loading">) {
  if (typeof window === "undefined") {
    return;
  }

  if (!state.accessToken || !state.refreshToken || !state.user) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      user: state.user,
      accessToken: state.accessToken,
      refreshToken: state.refreshToken
    })
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    loading: true
  });

  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);

  useEffect(() => {
    const stored = loadStoredAuth();
    setState({ ...stored, loading: false });
    accessRef.current = stored.accessToken;
    refreshRef.current = stored.refreshToken;
  }, []);

  const updateState = useCallback((next: Omit<AuthState, "loading">) => {
    accessRef.current = next.accessToken;
    refreshRef.current = next.refreshToken;
    setState((prev) => ({ ...prev, ...next, loading: false }));
    persistAuth(next);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const deviceId = getDeviceId();
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, deviceId })
    });

    if (!res.ok) {
      const payload = await parseErrorPayload(res);
      const code = payload?.code ?? (payload?.message as { code?: string } | undefined)?.code;
      const adminEmail =
        payload?.adminEmail ?? (payload?.message as { adminEmail?: string } | undefined)?.adminEmail;
      if (res.status === 403 && code === "ACCESS_DENIED") {
        throw new AccessDeniedError(adminEmail);
      }
      throw new Error(typeof payload?.message === "string" ? payload.message : "Login failed");
    }

    const data = (await res.json()) as { user: AuthUser; accessToken: string; refreshToken: string };
    updateState({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
  }, [updateState]);

  const register = useCallback(async (email: string, password: string) => {
    const deviceId = getDeviceId();
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, deviceId })
    });

    if (!res.ok) {
      const payload = await parseErrorPayload(res);
      const code = payload?.code ?? (payload?.message as { code?: string } | undefined)?.code;
      const adminEmail =
        payload?.adminEmail ?? (payload?.message as { adminEmail?: string } | undefined)?.adminEmail;
      if (res.status === 403 && code === "ACCESS_DENIED") {
        throw new AccessDeniedError(adminEmail);
      }
      throw new Error(typeof payload?.message === "string" ? payload.message : "Register failed");
    }

    const data = (await res.json()) as { user: AuthUser; accessToken: string; refreshToken: string };
    updateState({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
  }, [updateState]);

  const refresh = useCallback(async () => {
    const refreshToken = refreshRef.current;
    if (!refreshToken) {
      updateState({ user: null, accessToken: null, refreshToken: null });
      return;
    }

    const deviceId = getDeviceId();
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken, deviceId })
    });

    if (!res.ok) {
      updateState({ user: null, accessToken: null, refreshToken: null });
      return;
    }

    const data = (await res.json()) as { user: AuthUser; accessToken: string; refreshToken: string };
    updateState({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
  }, [updateState]);

  const logout = useCallback(async () => {
    const deviceId = getDeviceId();
    const accessToken = accessRef.current;

    if (accessToken) {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ deviceId })
      });
    }

    updateState({ user: null, accessToken: null, refreshToken: null });
  }, [updateState]);

  const authFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const accessToken = accessRef.current;
      const headers = new Headers(options.headers ?? {});
      const isFormData =
        typeof FormData !== "undefined" && options.body instanceof FormData;
      const isUrlEncoded = options.body instanceof URLSearchParams;
      if (!headers.has("Content-Type") && options.body && !isFormData && !isUrlEncoded) {
        headers.set("Content-Type", "application/json");
      }
      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }

      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers
      });

      if (response.status !== 401 || !refreshRef.current || !navigator.onLine) {
        return response;
      }

      await refresh();
      const retryHeaders = new Headers(options.headers ?? {});
      const nextAccess = accessRef.current;
      if (nextAccess) {
        retryHeaders.set("Authorization", `Bearer ${nextAccess}`);
      }
      if (!retryHeaders.has("Content-Type") && options.body) {
        const isRetryFormData =
          typeof FormData !== "undefined" && options.body instanceof FormData;
        const isRetryUrlEncoded = options.body instanceof URLSearchParams;
        if (!isRetryFormData && !isRetryUrlEncoded) {
          retryHeaders.set("Content-Type", "application/json");
        }
      }

      return fetch(`${API_URL}${path}`, {
        ...options,
        headers: retryHeaders
      });
    },
    [refresh]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      register,
      logout,
      refresh,
      authFetch
    }),
    [state, login, register, logout, refresh, authFetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
