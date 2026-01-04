import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WalletRole } from "@gf/shared";

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
            accounts: true
          }
        }
      }
    });

    return memberships.map((m) => ({
      role: m.role,
      wallet: m.wallet
    }));
  }

  async addMember(walletId: string, email: string, role: WalletRole) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const existing = await this.prisma.walletMember.findFirst({
      where: { walletId, userId: user.id }
    });

    if (existing) {
      throw new ConflictException("User already member");
    }

    return this.prisma.walletMember.create({
      data: {
        walletId,
        userId: user.id,
        role
      }
    });
  }
}
