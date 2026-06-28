"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { UserRole } from "@gf/shared";
import { getDeviceId } from "./device";
import { clearWalletCache } from "./db";
import { resolveApiUrl } from "./runtime-config";

const STORAGE_KEY = "gf.auth";

type AuthUser = { id: string; email: string; name: string; role: UserRole; defaultWalletId?: string | null };

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  authFetch: (path: string, options?: RequestInit) => Promise<Response>;
};

type StoredAuth = {
  user: Partial<AuthUser> | null;
  accessToken: string | null;
};

type AuthResponse = {
  user: AuthUser;
  accessToken: string;
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
    return { user: null, accessToken: null };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { user: null, accessToken: null };
  }

  try {
    const parsed = JSON.parse(raw) as StoredAuth & { refreshToken?: string | null };
    if (!parsed.user || !parsed.accessToken) {
      return { user: null, accessToken: null };
    }
    return {
      user: {
        id: parsed.user.id ?? "",
        email: parsed.user.email ?? "",
        name: parsed.user.name ?? "",
        role: parsed.user.role ?? UserRole.MEMBER,
        defaultWalletId: parsed.user.defaultWalletId ?? null
      },
      accessToken: parsed.accessToken
    };
  } catch {
    return { user: null, accessToken: null };
  }
}

function persistAuth(state: Omit<AuthState, "loading">) {
  if (typeof window === "undefined") {
    return;
  }

  if (!state.accessToken || !state.user) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      user: state.user,
      accessToken: state.accessToken
    })
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    loading: true
  });

  const accessRef = useRef<string | null>(null);

  const updateState = useCallback((next: Omit<AuthState, "loading">) => {
    accessRef.current = next.accessToken;
    setState((prev) => ({ ...prev, ...next, loading: false }));
    persistAuth(next);
    if (!next.user) {
      void clearWalletCache();
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const deviceId = getDeviceId();
      const apiUrl = resolveApiUrl();
      const res = await fetch(`${apiUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId })
      });

      if (!res.ok) {
        updateState({ user: null, accessToken: null });
        return;
      }

      const data = (await res.json()) as AuthResponse;
      updateState({ user: data.user, accessToken: data.accessToken });
    } catch {
      updateState({ user: null, accessToken: null });
    }
  }, [updateState]);

  useEffect(() => {
    const stored = loadStoredAuth();
    const hasStoredSession = Boolean(stored.user && stored.accessToken);

    setState({
      user: hasStoredSession ? stored.user : null,
      accessToken: hasStoredSession ? stored.accessToken : null,
      loading: !hasStoredSession
    });
    accessRef.current = hasStoredSession ? stored.accessToken : null;

    if (!hasStoredSession) {
      void refresh();
    }
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const deviceId = getDeviceId();
    const apiUrl = resolveApiUrl();
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      credentials: "include",
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

    const data = (await res.json()) as AuthResponse;
    updateState({ user: data.user, accessToken: data.accessToken });
    return data.user;
  }, [updateState]);

  const register = useCallback(async (email: string, password: string) => {
    const deviceId = getDeviceId();
    const apiUrl = resolveApiUrl();
    const res = await fetch(`${apiUrl}/auth/register`, {
      method: "POST",
      credentials: "include",
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

    const data = (await res.json()) as AuthResponse;
    updateState({ user: data.user, accessToken: data.accessToken });
    return data.user;
  }, [updateState]);

  const logout = useCallback(async () => {
    const deviceId = getDeviceId();
    const accessToken = accessRef.current;
    const apiUrl = resolveApiUrl();

    if (accessToken) {
      await fetch(`${apiUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ deviceId })
      });
    }

    updateState({ user: null, accessToken: null });
  }, [updateState]);

  const authFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const apiUrl = resolveApiUrl();
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

      const response = await fetch(`${apiUrl}${path}`, {
        ...options,
        credentials: "include",
        headers
      });

      if (response.status !== 401 || !navigator.onLine) {
        return response;
      }

      await refresh();
      const nextAccess = accessRef.current;
      if (!nextAccess) {
        return response;
      }

      const retryHeaders = new Headers(options.headers ?? {});
      retryHeaders.set("Authorization", `Bearer ${nextAccess}`);
      if (!retryHeaders.has("Content-Type") && options.body) {
        const isRetryFormData =
          typeof FormData !== "undefined" && options.body instanceof FormData;
        const isRetryUrlEncoded = options.body instanceof URLSearchParams;
        if (!isRetryFormData && !isRetryUrlEncoded) {
          retryHeaders.set("Content-Type", "application/json");
        }
      }

      return fetch(`${apiUrl}${path}`, {
        ...options,
        credentials: "include",
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
