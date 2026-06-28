import { Body, Controller, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { AuthRegisterDto } from "./dto/auth-register.dto";
import { AuthLoginDto } from "./dto/auth-login.dto";
import { AuthRefreshDto } from "./dto/auth-refresh.dto";
import { AuthLogoutDto } from "./dto/auth-logout.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser } from "./current-user.decorator";
import { clearRefreshTokenCookie, readRefreshTokenCookie, setRefreshTokenCookie } from "./refresh-token-cookie";
import type { Request, Response } from "express";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @Throttle({ default: { limit: 10, ttl: 60 } })
  async register(@Body() dto: AuthRegisterDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.register(dto.email, dto.password, dto.deviceId);
    setRefreshTokenCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
    return {
      user: session.user,
      accessToken: session.accessToken
    };
  }

  @Post("login")
  @Throttle({ default: { limit: 10, ttl: 60 } })
  async login(@Body() dto: AuthLoginDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.login(dto.email, dto.password, dto.deviceId);
    setRefreshTokenCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
    return {
      user: session.user,
      accessToken: session.accessToken
    };
  }

  @Post("refresh")
  @Throttle({ default: { limit: 20, ttl: 60 } })
  async refresh(
    @Body() dto: AuthRefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const refreshToken = dto.refreshToken ?? readRefreshTokenCookie(request.headers.cookie);
    const session = await this.auth.refresh(refreshToken, dto.deviceId);
    setRefreshTokenCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
    return {
      user: session.user,
      accessToken: session.accessToken
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(
    @CurrentUser() user: { userId: string },
    @Body() dto: AuthLogoutDto,
    @Res({ passthrough: true }) res: Response
  ) {
    await this.auth.logout(user.userId, dto.deviceId);
    clearRefreshTokenCookie(res);
    return { ok: true };
  }
}
