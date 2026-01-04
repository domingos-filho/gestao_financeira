import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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

  createUser(email: string, passwordHash: string) {
    return this.prisma.user.create({
      data: {
        email: this.normalizeEmail(email),
        passwordHash
      }
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
