import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { WalletRole } from "@gf/shared";
import { describe, expect, it, vi } from "vitest";
import { WalletRoleGuard } from "../src/common/guards/wallet-role.guard";
import { PrismaService } from "../src/prisma/prisma.service";

describe("WalletRoleGuard", () => {
  it("allows the configured admin to access any wallet without membership", async () => {
    const prisma = {
      walletMember: {
        findFirst: vi.fn()
      }
    } as unknown as PrismaService;
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([WalletRole.ADMIN])
    } as unknown as Reflector;
    const config = {
      get: vi.fn((key: string) => (key === "ADMIN_EMAIL" ? "admin@example.com" : undefined))
    } as unknown as ConfigService;
    const guard = new WalletRoleGuard(prisma, reflector, config);

    const result = await guard.canActivate({
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () =>
        ({
          getRequest: () => ({
            params: { walletId: "wallet-1" },
            user: { userId: "user-1", email: "admin@example.com" }
          })
        }) as never
    } as never);

    expect(result).toBe(true);
    expect(prisma.walletMember.findFirst).not.toHaveBeenCalled();
  });
});
