import { UserRole } from "@gf/shared";
import { describe, expect, it, vi } from "vitest";
import { AuthController } from "../src/auth/auth.controller";
import { AuthService } from "../src/auth/auth.service";
import { REFRESH_TOKEN_COOKIE_NAME } from "../src/auth/refresh-token-cookie";

type UserSession = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  defaultWalletId: string | null;
};

function createResponseMock() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn()
  };
}

describe("AuthController", () => {
  const refreshTokenExpiresAt = new Date("2026-07-01T12:00:00.000Z");
  const user: UserSession = {
    id: "user-1",
    email: "maria@example.com",
    name: "Maria",
    role: UserRole.MEMBER,
    defaultWalletId: "wallet-1"
  };
  const authService = {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn()
  } as unknown as AuthService;
  const controller = new AuthController(authService);

  it("sets an HttpOnly refresh cookie on register", async () => {
    authService.register = vi.fn().mockResolvedValue({
      user,
      accessToken: "access-token",
      refreshToken: "refresh-token",
      refreshTokenExpiresAt
    }) as unknown as AuthService["register"];
    const res = createResponseMock();

    const result = await controller.register(
      {
        email: "maria@example.com",
        password: "secret123",
        deviceId: "device-1"
      },
      res as never
    );

    expect(result).toEqual({
      user,
      accessToken: "access-token"
    });
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE_NAME,
      "refresh-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        path: "/api",
        secure: expect.any(Boolean),
        expires: refreshTokenExpiresAt
      })
    );
  });

  it("sets an HttpOnly refresh cookie on login", async () => {
    authService.login = vi.fn().mockResolvedValue({
      user,
      accessToken: "access-token",
      refreshToken: "refresh-token",
      refreshTokenExpiresAt
    }) as unknown as AuthService["login"];
    const res = createResponseMock();

    const result = await controller.login(
      {
        email: "maria@example.com",
        password: "secret123",
        deviceId: "device-1"
      },
      res as never
    );

    expect(result).toEqual({
      user,
      accessToken: "access-token"
    });
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE_NAME,
      "refresh-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        path: "/api",
        secure: expect.any(Boolean),
        expires: refreshTokenExpiresAt
      })
    );
  });

  it("accepts the refresh token from the cookie header", async () => {
    authService.refresh = vi.fn().mockResolvedValue({
      user,
      accessToken: "fresh-access-token",
      refreshToken: "fresh-refresh-token",
      refreshTokenExpiresAt
    }) as unknown as AuthService["refresh"];
    const res = createResponseMock();

    const result = await controller.refresh(
      {
        deviceId: "device-1"
      },
      {
        headers: {
          cookie: `session=abc; ${REFRESH_TOKEN_COOKIE_NAME}=refresh-cookie`
        }
      } as never,
      res as never
    );

    expect(authService.refresh).toHaveBeenCalledWith("refresh-cookie", "device-1");
    expect(result).toEqual({
      user,
      accessToken: "fresh-access-token"
    });
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE_NAME,
      "fresh-refresh-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        path: "/api",
        secure: expect.any(Boolean),
        expires: refreshTokenExpiresAt
      })
    );
  });

  it("clears the refresh cookie on logout", async () => {
    authService.logout = vi.fn().mockResolvedValue(undefined) as unknown as AuthService["logout"];
    const res = createResponseMock();

    const result = await controller.logout(
      { userId: "user-1" },
      {
        deviceId: "device-1"
      },
      res as never
    );

    expect(authService.logout).toHaveBeenCalledWith("user-1", "device-1");
    expect(result).toEqual({ ok: true });
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE_NAME,
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        path: "/api",
        secure: expect.any(Boolean)
      })
    );
  });
});
