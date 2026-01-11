import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WalletRole } from "@gf/shared";
import { DEFAULT_CATEGORIES } from "../categories/default-categories";

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async createWallet(userId: string, name: string) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.create({
        data: {
          name,
          createdById: userId,
          members: {
            create: {
              userId,
              role: WalletRole.ADMIN
            }
          },
          accounts: {
            create: {
              name: "Conta principal"
            }
          },
          categories: {
            createMany: {
              data: DEFAULT_CATEGORIES
            }
          }
        },
        include: {
          accounts: true
        }
      });

      return wallet;
    });
  }

  async listWallets(userId: string) {
    const memberships = await this.prisma.walletMember.findMany({
      where: { userId },
      include: {
        wallet: {
          include: {
            accounts: true,
            _count: { select: { members: true } }
          }
        }
      }
    });

    return memberships.map((m) => ({
      role: m.role,
      wallet: {
        id: m.wallet.id,
        name: m.wallet.name,
        accounts: m.wallet.accounts,
        membersCount: m.wallet._count.members
      }
    }));
  }

  async listAllWallets() {
    const wallets = await this.prisma.wallet.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { members: true, accounts: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return wallets.map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      membersCount: wallet._count.members,
      accountsCount: wallet._count.accounts
    }));
  }

  async updateWallet(walletId: string, name: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) {
      throw new NotFoundException("Wallet not found");
    }

    return this.prisma.wallet.update({
      where: { id: walletId },
      data: { name }
    });
  }

  async deleteWallet(walletId: string) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
      if (!wallet) {
        throw new NotFoundException("Wallet not found");
      }

      await tx.transaction.deleteMany({ where: { walletId } });
      await tx.syncEvent.deleteMany({ where: { walletId } });
      await tx.debt.deleteMany({ where: { walletId } });
      await tx.category.deleteMany({ where: { walletId } });
      await tx.account.deleteMany({ where: { walletId } });
      await tx.walletMember.deleteMany({ where: { walletId } });

      return tx.wallet.delete({ where: { id: walletId } });
    });
  }
}
