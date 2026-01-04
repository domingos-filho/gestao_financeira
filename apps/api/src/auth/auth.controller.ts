import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { AuthRegisterDto } from "./dto/auth-register.dto";
import { AuthLoginDto } from "./dto/auth-login.dto";
import { AuthRefreshDto } from "./dto/auth-refresh.dto";
import { AuthLogoutDto } from "./dto/auth-logout.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser } from "./current-user.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @Throttle(10, 60)
  register(@Body() dto: AuthRegisterDto) {
    return this.auth.register(dto.email, dto.password, dto.deviceId);
  }

  @Post("login")
  @Throttle(10, 60)
  login(@Body() dto: AuthLoginDto) {
    return this.auth.login(dto.email, dto.password, dto.deviceId);
  }

  @Post("refresh")
  @Throttle(20, 60)
  refresh(@Body() dto: AuthRefreshDto) {
    return this.auth.refresh(dto.refreshToken, dto.deviceId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(@CurrentUser() user: { userId: string }, @Body() dto: AuthLogoutDto) {
    await this.auth.logout(user.userId, dto.deviceId);
    return { ok: true };
  }
}
