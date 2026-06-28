import { BadRequestException } from "@nestjs/common";
import { UserRole, WalletRole } from "@gf/shared";
import * as bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsersService } from "../src/users/users.service";

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("hashed-password")
}));

const mockedHash = vi.mocked(bcrypt.hash);

describe("UsersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes stale memberships when a managed user is moved to another wallet", async () => {
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user-1",
          name: "Maria",
          email: "member@example.com",
          role: UserRole.MEMBER,
          defaultWalletId: "wallet-old",
          defaultWallet: { id: "wallet-old", name: "Carteira antiga" }
        }),
        update: vi.fn().mockResolvedValue({
          id: "user-1",
          name: "Maria Atualizada",
          email: "member@example.com",
          role: UserRole.MEMBER,
          defaultWallet: { id: "wallet-new", name: "Carteira nova" }
        })
      },
      wallet: {
        findUnique: vi.fn().mockResolvedValue({ id: "wallet-new", name: "Carteira nova" })
      },
      walletMember: {
        findUnique: vi.fn().mockResolvedValue(null),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({})
      },
      accessGrant: {
        upsert: vi.fn().mockResolvedValue({})
      }
    };

    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      ...tx
    } as any;
    const config = {
      get: vi.fn().mockReturnValue("admin@example.com")
    } as any;
    const service = new UsersService(prisma, config);

    const result = await service.updateManagedUser("user-1", {
      name: "Maria Atualizada",
      walletId: "wallet-new"
    });

    expect(tx.walletMember.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        walletId: { not: "wallet-new" }
      }
    });
    expect(tx.walletMember.create).toHaveBeenCalledWith({
      data: {
        walletId: "wallet-new",
        userId: "user-1",
        role: WalletRole.EDITOR
      }
    });
    expect(result.defaultWallet).toEqual({ id: "wallet-new", name: "Carteira nova" });
  });

  it("rejects short names when creating managed users", async () => {
    const tx = {
      wallet: {
        findUnique: vi.fn().mockResolvedValue({ id: "wallet-new", name: "Carteira nova" })
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn()
      },
      walletMember: {
        create: vi.fn()
      },
      accessGrant: {
        upsert: vi.fn()
      }
    };

    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    } as any;
    const config = {
      get: vi.fn().mockReturnValue("admin@example.com")
    } as any;
    const service = new UsersService(prisma, config);

    await expect(
      service.createManagedUser({
        name: "A",
        email: "new@example.com",
        password: "secret123",
        role: UserRole.MEMBER,
        walletId: "wallet-new"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockedHash).not.toHaveBeenCalled();
  });
});
