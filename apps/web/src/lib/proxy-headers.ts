type HeadersWithSetCookie = Headers & {
  getSetCookie?: () => string[];
};

export function appendSetCookieHeaders(targetHeaders: Headers, sourceHeaders: Headers) {
  const headers = sourceHeaders as HeadersWithSetCookie;
  const setCookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : sourceHeaders.get("set-cookie")
        ? [sourceHeaders.get("set-cookie") as string]
        : [];

  if (setCookies.length === 0) {
    return;
  }

  targetHeaders.delete("set-cookie");
  for (const cookie of setCookies) {
    targetHeaders.append("set-cookie", cookie);
  }
}
