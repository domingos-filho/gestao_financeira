import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AccessStatus, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  private get adminEmail() {
    return (this.config.get<string>("ADMIN_EMAIL")?.trim() || "fadomingosf@gmail.com").toLowerCase();
  }

  private get adminPassword() {
    const password = this.config.get<string>("ADMIN_PASSWORD")?.trim();
    if (password) {
      return password;
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_PASSWORD is required");
    }

    return "secret123";
  }

  async onApplicationBootstrap() {
    await this.syncAdminAccount();
  }

  async syncAdminAccount() {
    await this.prisma.$connect();

    const email = this.adminEmail;
    const password = this.adminPassword;
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        role: true
      }
    });

    if (!existing) {
      await this.prisma.user.create({
        data: {
          email,
          name: "Administrador",
          passwordHash: await bcrypt.hash(password, 12),
          role: UserRole.ADMIN
        }
      });
    } else {
      const passwordMatches = await bcrypt.compare(password, existing.passwordHash);
      const data: { passwordHash?: string; role?: UserRole } = {};

      if (!passwordMatches) {
        data.passwordHash = await bcrypt.hash(password, 12);
      }

      if (existing.role !== UserRole.ADMIN) {
        data.role = UserRole.ADMIN;
      }

      if (Object.keys(data).length > 0) {
        await this.prisma.user.update({
          where: { email },
          data
        });

        if (!passwordMatches) {
          await this.prisma.refreshToken.updateMany({
            where: {
              userId: existing.id,
              revokedAt: null
            },
            data: {
              revokedAt: new Date()
            }
          });
        }
      }
    }

    await this.prisma.accessGrant.upsert({
      where: { email },
      create: {
        email,
        status: AccessStatus.ALLOWED
      },
      update: {
        status: AccessStatus.ALLOWED
      }
    });

    this.logger.log(`Admin account synced for ${email}`);
  }
}
