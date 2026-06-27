import { AccessStatus, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminBootstrapService } from "../src/auth/admin-bootstrap.service";

vi.mock("bcryptjs", () => ({
  hash: vi.fn(),
  compare: vi.fn()
}));

const mockedHash = vi.mocked(bcrypt.hash);
const mockedCompare = vi.mocked(bcrypt.compare);

describe("AdminBootstrapService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the admin account from environment variables when it does not exist", async () => {
    const prisma = {
      $connect: vi.fn(),
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "user-1" }),
        update: vi.fn()
      },
      refreshToken: {
        updateMany: vi.fn()
      },
      accessGrant: {
        upsert: vi.fn()
      }
    } as any;
    const config = {
      get: vi.fn((key: string) => {
        if (key === "ADMIN_EMAIL") {
          return "admin@example.com";
        }

        if (key === "ADMIN_PASSWORD") {
          return "strong-admin-password";
        }

        return undefined;
      })
    } as any;

    mockedHash.mockResolvedValue("hashed-password");

    const service = new AdminBootstrapService(prisma, config);
    await service.syncAdminAccount();

    expect(prisma.$connect).toHaveBeenCalledTimes(1);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: "admin@example.com",
        name: "Administrador",
        passwordHash: "hashed-password",
        role: UserRole.ADMIN
      }
    });
    expect(prisma.accessGrant.upsert).toHaveBeenCalledWith({
      where: { email: "admin@example.com" },
      create: {
        email: "admin@example.com",
        status: AccessStatus.ALLOWED
      },
      update: {
        status: AccessStatus.ALLOWED
      }
    });
    expect(mockedCompare).not.toHaveBeenCalled();
  });

  it("updates the admin password and revokes refresh tokens when the secret changes", async () => {
    const prisma = {
      $connect: vi.fn(),
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user-1",
          passwordHash: "old-hash",
          role: UserRole.ADMIN
        }),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: "user-1" })
      },
      refreshToken: {
        updateMany: vi.fn()
      },
      accessGrant: {
        upsert: vi.fn()
      }
    } as any;
    const config = {
      get: vi.fn((key: string) => {
        if (key === "ADMIN_EMAIL") {
          return "admin@example.com";
        }

        if (key === "ADMIN_PASSWORD") {
          return "rotated-admin-password";
        }

        return undefined;
      })
    } as any;

    mockedCompare.mockImplementation(async () => false);
    mockedHash.mockResolvedValue("new-hash");

    const service = new AdminBootstrapService(prisma, config);
    await service.syncAdminAccount();

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { email: "admin@example.com" },
      data: {
        passwordHash: "new-hash"
      }
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        revokedAt: null
      },
      data: {
        revokedAt: expect.any(Date)
      }
    });
    expect(prisma.accessGrant.upsert).toHaveBeenCalledWith({
      where: { email: "admin@example.com" },
      create: {
        email: "admin@example.com",
        status: AccessStatus.ALLOWED
      },
      update: {
        status: AccessStatus.ALLOWED
      }
    });
  });
});
