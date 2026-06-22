import { UserRole } from "@gf/shared";
import { describe, expect, it, vi } from "vitest";
import { UsersAdminController } from "../src/users/users-admin.controller";
import { UsersService } from "../src/users/users.service";

describe("UsersAdminController", () => {
  const usersService = {
    listWalletOptions: vi.fn(),
    createManagedUser: vi.fn(),
    updateManagedUser: vi.fn(),
    deleteManagedUser: vi.fn()
  } as unknown as UsersService;
  const controller = new UsersAdminController(usersService);

  it("lists wallet options", async () => {
    usersService.listWalletOptions = vi.fn().mockResolvedValue([{ id: "wallet-1", name: "Carteira principal" }]) as unknown as UsersService["listWalletOptions"];

    await expect(controller.listWalletOptions()).resolves.toEqual([{ id: "wallet-1", name: "Carteira principal" }]);

    expect(usersService.listWalletOptions).toHaveBeenCalledTimes(1);
  });

  it("creates a managed user", async () => {
    usersService.createManagedUser = vi.fn().mockResolvedValue({
      id: "user-1",
      name: "Maria",
      email: "maria@example.com",
      role: UserRole.MEMBER,
      defaultWallet: { id: "wallet-1", name: "Carteira principal" }
    }) as unknown as UsersService["createManagedUser"];

    const result = await controller.create({
      name: "Maria",
      email: "maria@example.com",
      password: "secret123",
      role: UserRole.MEMBER,
      walletId: "550e8400-e29b-41d4-a716-446655440000"
    });

    expect(usersService.createManagedUser).toHaveBeenCalledWith({
      name: "Maria",
      email: "maria@example.com",
      password: "secret123",
      role: UserRole.MEMBER,
      walletId: "550e8400-e29b-41d4-a716-446655440000"
    });
    expect(result).toEqual({
      id: "user-1",
      name: "Maria",
      email: "maria@example.com",
      role: UserRole.MEMBER,
      defaultWallet: { id: "wallet-1", name: "Carteira principal" }
    });
  });
});
