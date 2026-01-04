import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { WalletRoles } from "../common/decorators/wallet-role.decorator";
import { WalletRoleGuard } from "../common/guards/wallet-role.guard";
import { WalletRole } from "@gf/shared";
import { SyncPushDto } from "./dto/sync-push.dto";
import { SyncPullQueryDto } from "./dto/sync-pull.dto";
import { SyncService } from "./sync.service";
import { SyncEventType } from "@prisma/client";

@Controller("sync")
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post("push")
  @Throttle({ default: { limit: 30, ttl: 60 } })
  @WalletRoles(WalletRole.EDITOR)
  @UseGuards(JwtAuthGuard, WalletRoleGuard)
  push(@CurrentUser() user: { userId: string }, @Body() dto: SyncPushDto) {
    return this.sync.pushEvents({
      userId: user.userId,
      walletId: dto.walletId,
      deviceId: dto.deviceId,
      events: dto.events.map((event) => ({
        eventId: event.eventId,
        walletId: event.walletId,
        deviceId: event.deviceId,
        eventType: event.eventType as SyncEventType,
        payload: event.payload
      }))
    });
  }

  @Get("pull")
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @WalletRoles(WalletRole.VIEWER)
  @UseGuards(JwtAuthGuard, WalletRoleGuard)
  pull(@Query() query: SyncPullQueryDto) {
    return this.sync.pullEvents(query.walletId, query.sinceSeq);
  }
}
