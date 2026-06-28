import { describe, expect, it, vi } from "vitest";
import { appendSetCookieHeaders } from "../src/lib/proxy-headers";

describe("appendSetCookieHeaders", () => {
  it("appends every cookie returned by getSetCookie", () => {
    const deleteMock = vi.fn();
    const appendMock = vi.fn();
    const target = {
      delete: deleteMock,
      append: appendMock
    } as unknown as Headers;
    const source = {
      getSetCookie: () => ["gf_refresh_token=token-1; Path=/api", "gf_session=session-1; Path=/"]
    } as unknown as Headers;

    appendSetCookieHeaders(target, source);

    expect(deleteMock).toHaveBeenCalledWith("set-cookie");
    expect(appendMock).toHaveBeenNthCalledWith(1, "set-cookie", "gf_refresh_token=token-1; Path=/api");
    expect(appendMock).toHaveBeenNthCalledWith(2, "set-cookie", "gf_session=session-1; Path=/");
  });

  it("falls back to a single set-cookie header when getSetCookie is unavailable", () => {
    const deleteMock = vi.fn();
    const appendMock = vi.fn();
    const target = {
      delete: deleteMock,
      append: appendMock
    } as unknown as Headers;
    const source = {
      get: (name: string) => (name === "set-cookie" ? "gf_refresh_token=token-2; Path=/api" : null)
    } as unknown as Headers;

    appendSetCookieHeaders(target, source);

    expect(deleteMock).toHaveBeenCalledWith("set-cookie");
    expect(appendMock).toHaveBeenCalledWith("set-cookie", "gf_refresh_token=token-2; Path=/api");
  });
});
