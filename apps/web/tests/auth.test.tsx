import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../src/lib/auth";

vi.mock("../src/lib/device", () => ({
  getDeviceId: () => "device-1"
}));

function AuthHarness() {
  const { login, refresh, user, accessToken, loading } = useAuth();

  return (
    <div>
      <div data-testid="status">{loading ? "loading" : user ? accessToken ?? "signed-in" : "signed-out"}</div>
      <button type="button" onClick={() => login("maria@example.com", "secret123")}>
        login
      </button>
      <button type="button" onClick={() => refresh()}>
        refresh
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.__GF_RUNTIME_CONFIG__ = { apiUrl: "/api" };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    delete window.__GF_RUNTIME_CONFIG__;
  });

  it("persists only the access token and user after login", async () => {
    window.localStorage.setItem(
      "gf.auth",
      JSON.stringify({
        user: {
          id: "user-0",
          email: "seed@example.com",
          name: "Seed",
          role: "MEMBER",
          defaultWalletId: "wallet-0"
        },
        accessToken: "seed-access-token"
      })
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(url).toBe("/api/auth/login");
      expect(init?.credentials).toBe("include");
      expect(init?.body).toBe(JSON.stringify({
        email: "maria@example.com",
        password: "secret123",
        deviceId: "device-1"
      }));

      return new Response(
        JSON.stringify({
          user: {
            id: "user-1",
            email: "maria@example.com",
            name: "Maria",
            role: "MEMBER",
            defaultWalletId: "wallet-1"
          },
          accessToken: "access-token"
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );

    await user.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("access-token");
    });

    const stored = JSON.parse(window.localStorage.getItem("gf.auth") ?? "{}") as {
      user?: unknown;
      accessToken?: string;
      refreshToken?: string;
    };
    expect(stored.accessToken).toBe("access-token");
    expect(stored.user).toEqual({
      id: "user-1",
      email: "maria@example.com",
      name: "Maria",
      role: "MEMBER",
      defaultWalletId: "wallet-1"
    });
    expect(stored.refreshToken).toBeUndefined();
  });

  it("refreshes using the HttpOnly cookie without sending a refresh token in the body", async () => {
    window.localStorage.setItem(
      "gf.auth",
      JSON.stringify({
        user: {
          id: "user-1",
          email: "maria@example.com",
          name: "Maria",
          role: "MEMBER",
          defaultWalletId: "wallet-1"
        },
        accessToken: "expired-access-token"
      })
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(url).toBe("/api/auth/refresh");
      expect(init?.credentials).toBe("include");
      expect(init?.body).toBe(JSON.stringify({ deviceId: "device-1" }));

      return new Response(
        JSON.stringify({
          user: {
            id: "user-1",
            email: "maria@example.com",
            name: "Maria",
            role: "MEMBER",
            defaultWalletId: "wallet-1"
          },
          accessToken: "fresh-access-token"
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );

    await user.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("fresh-access-token");
    });

    const stored = JSON.parse(window.localStorage.getItem("gf.auth") ?? "{}") as {
      accessToken?: string;
      refreshToken?: string;
    };
    expect(stored.accessToken).toBe("fresh-access-token");
    expect(stored.refreshToken).toBeUndefined();
  });
});
