import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UserRole, WalletRole } from "@gf/shared";
import * as bcrypt from "bcrypt";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: this.normalizeEmail(email) } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createUser(
    email: string,
    passwordHash: string,
    options?: { name?: string; role?: UserRole; defaultWalletId?: string | null }
  ) {
    return this.prisma.user.create({
      data: {
        email: this.normalizeEmail(email),
        passwordHash,
        name: options?.name?.trim() ?? undefined,
        role: options?.role,
        defaultWalletId: options?.defaultWalletId ?? undefined
      }
    });
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      include: {
        defaultWallet: true
      },
      orderBy: { createdAt: "desc" }
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      defaultWallet: user.defaultWallet ? { id: user.defaultWallet.id, name: user.defaultWallet.name } : null
    }));
  }

  async createManagedUser(params: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    walletId: string;
  }) {
    const normalized = this.normalizeEmail(params.email);

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { id: params.walletId } });
      if (!wallet) {
        throw new NotFoundException("Wallet not found");
      }

      const existing = await tx.user.findUnique({ where: { email: normalized } });
      if (existing) {
        throw new ConflictException("Email already registered");
      }

      const trimmedName = params.name.trim();
      if (trimmedName.length < 2) {
        throw new BadRequestException("Name is required");
      }

      const passwordHash = await bcrypt.hash(params.password, 12);
      const user = await tx.user.create({
        data: {
          name: trimmedName,
          email: normalized,
          passwordHash,
          role: params.role,
          defaultWalletId: params.walletId
        }
      });

      await tx.walletMember.create({
        data: {
          walletId: params.walletId,
          userId: user.id,
          role: params.role === UserRole.ADMIN ? WalletRole.ADMIN : WalletRole.EDITOR
        }
      });

      await tx.accessGrant.upsert({
        where: { email: normalized },
        create: { email: normalized, status: "ALLOWED" },
        update: { status: "ALLOWED" }
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        defaultWallet: { id: wallet.id, name: wallet.name }
      };
    });
  }

  async updateManagedUser(
    userId: string,
    params: {
      name?: string;
      password?: string;
      role?: UserRole;
      walletId?: string;
    }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { defaultWallet: true }
      });

      if (!user) {
        throw new NotFoundException("User not found");
      }

      const data: {
        name?: string;
        passwordHash?: string;
        role?: UserRole;
        defaultWalletId?: string | null;
      } = {};

      if (params.name) {
        const trimmedName = params.name.trim();
        if (trimmedName.length < 2) {
          throw new BadRequestException("Name is required");
        }
        data.name = trimmedName;
      }

      if (params.password) {
        data.passwordHash = await bcrypt.hash(params.password, 12);
      }

      if (params.role) {
        data.role = params.role;
      }

      const targetWalletId = params.walletId ?? user.defaultWalletId ?? undefined;
      if (params.walletId) {
        const wallet = await tx.wallet.findUnique({ where: { id: params.walletId } });
        if (!wallet) {
          throw new NotFoundException("Wallet not found");
        }
        data.defaultWalletId = params.walletId;
      }

      if (targetWalletId) {
        const desiredRole = params.role ?? user.role;
        const walletRole = desiredRole === UserRole.ADMIN ? WalletRole.ADMIN : WalletRole.EDITOR;
        const existingMember = await tx.walletMember.findUnique({
          where: { walletId_userId: { walletId: targetWalletId, userId } }
        });

        if (existingMember) {
          await tx.walletMember.update({
            where: { id: existingMember.id },
            data: { role: walletRole }
          });
        } else {
          await tx.walletMember.create({
            data: {
              walletId: targetWalletId,
              userId,
              role: walletRole
            }
          });
        }
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data,
        include: { defaultWallet: true }
      });

      return {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        defaultWallet: updated.defaultWallet
          ? { id: updated.defaultWallet.id, name: updated.defaultWallet.name }
          : null
      };
    });
  }

  listAccess() {
    return this.prisma.accessGrant.findMany({
      orderBy: { createdAt: "desc" }
    });
  }

  getAccess(email: string) {
    return this.prisma.accessGrant.findUnique({
      where: { email: this.normalizeEmail(email) }
    });
  }

  grantAccess(email: string) {
    const normalized = this.normalizeEmail(email);
    return this.prisma.accessGrant.upsert({
      where: { email: normalized },
      create: { email: normalized, status: "ALLOWED" },
      update: { status: "ALLOWED" }
    });
  }

  revokeAccess(email: string) {
    const normalized = this.normalizeEmail(email);
    return this.prisma.accessGrant.upsert({
      where: { email: normalized },
      create: { email: normalized, status: "REVOKED" },
      update: { status: "REVOKED" }
    });
  }
}
