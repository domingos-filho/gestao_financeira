import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  BadRequestException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { WalletRole } from "@gf/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { WALLET_ROLES_KEY } from "../decorators/wallet-role.decorator";

const ROLE_RANK: Record<WalletRole, number> = {
  [WalletRole.VIEWER]: 1,
  [WalletRole.EDITOR]: 2,
  [WalletRole.ADMIN]: 3
};

@Injectable()
export class WalletRoleGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<WalletRole[]>(WALLET_ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const walletId =
      request.params?.id ||
      request.params?.walletId ||
      request.body?.walletId ||
      request.query?.walletId;

    if (!walletId) {
      throw new BadRequestException("walletId is required");
    }

    const userId = request.user?.userId;
    const userEmail = typeof request.user?.email === "string" ? request.user.email.toLowerCase() : null;
    const adminEmail = (this.config.get<string>("ADMIN_EMAIL")?.trim() || "fadomingosf@gmail.com").toLowerCase();
    if (userEmail && userEmail === adminEmail) {
      return true;
    }

    if (!userId) {
      throw new ForbiddenException();
    }

    const membership = await this.prisma.walletMember.findFirst({
      where: { walletId, userId }
    });

    if (!membership) {
      throw new ForbiddenException();
    }

    const requiredRank = Math.min(...roles.map((role) => ROLE_RANK[role]));
    if (ROLE_RANK[membership.role] < requiredRank) {
      throw new ForbiddenException();
    }

    return true;
  }
}
