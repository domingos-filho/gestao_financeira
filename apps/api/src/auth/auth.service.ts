import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";
import { PrismaService } from "../prisma/prisma.service";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  private get accessSecret() {
    const secret = this.config.get<string>("JWT_SECRET");
    if (!secret && process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is required");
    }
    return secret ?? "dev_access_secret";
  }

  private get refreshSecret() {
    const secret = this.config.get<string>("REFRESH_TOKEN_SECRET");
    if (!secret && process.env.NODE_ENV === "production") {
      throw new Error("REFRESH_TOKEN_SECRET is required");
    }
    return secret ?? "dev_refresh_secret";
  }

  private get accessTtl() {
    return this.config.get<string>("JWT_EXPIRES_IN") ?? ACCESS_TOKEN_TTL;
  }

  private get refreshTtl() {
    return this.config.get<string>("REFRESH_TOKEN_EXPIRES_IN") ?? REFRESH_TOKEN_TTL;
  }

  private get adminEmail() {
    return (this.config.get<string>("ADMIN_EMAIL") ?? "fadomingosf@gmail.com").toLowerCase();
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private async assertAccessAllowed(email: string) {
    if (email === this.adminEmail) {
      return;
    }

    const access = await this.users.getAccess(email);
    if (!access || access.status !== "ALLOWED") {
      throw new ForbiddenException({
        code: "ACCESS_DENIED",
        adminEmail: this.adminEmail,
        message: "Access denied"
      });
    }
  }

  async register(email: string, password: string, deviceId: string) {
    const normalized = this.normalizeEmail(email);
    await this.assertAccessAllowed(normalized);
    const existing = await this.users.findByEmail(normalized);
    if (existing) {
      throw new ConflictException("Email already registered");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.users.createUser(normalized, passwordHash);
    return this.issueTokens(user.id, user.email, deviceId);
  }

  async login(email: string, password: string, deviceId: string) {
    const normalized = this.normalizeEmail(email);
    await this.assertAccessAllowed(normalized);
    const user = await this.users.findByEmail(normalized);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.issueTokens(user.id, user.email, deviceId);
  }

  async refresh(refreshToken: string, deviceId: string) {
    let payload: { sub: string; email: string; deviceId: string };

    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.refreshSecret
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (payload.deviceId !== deviceId) {
      throw new UnauthorizedException("Device mismatch");
    }

    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        deviceId,
        revokedAt: null
      },
      orderBy: { createdAt: "desc" }
    });

    if (!tokenRecord) {
      throw new UnauthorizedException("Refresh token not found");
    }

    const now = new Date();
    if (tokenRecord.expiresAt <= now) {
      throw new UnauthorizedException("Refresh token expired");
    }

    const match = await bcrypt.compare(refreshToken, tokenRecord.tokenHash);
    if (!match) {
      throw new UnauthorizedException("Refresh token mismatch");
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: now }
    });

    return this.issueTokens(payload.sub, payload.email, deviceId);
  }

  async logout(userId: string, deviceId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        deviceId,
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });
  }

  private async issueTokens(userId: string, email: string, deviceId: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.accessSecret,
        expiresIn: this.accessTtl
      }
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, email, deviceId },
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshTtl
      }
    );

    const decoded = this.jwt.decode(refreshToken) as { exp?: number };
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 86400000);
    const tokenHash = await bcrypt.hash(refreshToken, 12);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        deviceId,
        tokenHash,
        expiresAt
      }
    });

    return {
      user: { id: userId, email },
      accessToken,
      refreshToken
    };
  }
}
