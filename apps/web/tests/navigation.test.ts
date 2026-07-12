import { describe, expect, it } from "vitest";
import { isRouteActive } from "../src/lib/navigation";

describe("isRouteActive", () => {
  it("only marks the current page as active", () => {
    expect(isRouteActive("/wallets/123", "/wallets/123")).toBe(true);
    expect(isRouteActive("/wallets/123/reports", "/wallets/123")).toBe(false);
    expect(isRouteActive("/wallets", "/wallets")).toBe(true);
    expect(isRouteActive("/wallets/123/transactions", "/wallets/123/transactions")).toBe(true);
  });
});
