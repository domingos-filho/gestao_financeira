import type { Response } from "express";

export const REFRESH_TOKEN_COOKIE_NAME = "gf_refresh_token";

function getRefreshCookieBaseOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api"
  };
}

export function setRefreshTokenCookie(res: Response, refreshToken: string, expiresAt: Date) {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    ...getRefreshCookieBaseOptions(),
    expires: expiresAt
  });
}

export function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, getRefreshCookieBaseOptions());
}

export function readRefreshTokenCookie(cookieHeader?: string | null) {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = part.trim().split("=");
    if (rawName === REFRESH_TOKEN_COOKIE_NAME) {
      return decodeURIComponent(rawValueParts.join("="));
    }
  }

  return null;
}
