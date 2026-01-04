import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { WalletRoles } from "../common/decorators/wallet-role.decorator";
import { WalletRoleGuard } from "../common/guards/wallet-role.guard";
import { WalletRole } from "@gf/shared";
import { CreateWalletDto } from "./dto/create-wallet.dto";
import { AddMemberDto } from "./dto/add-member.dto";
import { WalletsService } from "./wallets.service";

@Controller("wallets")
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateWalletDto) {
    return this.wallets.createWallet(user.userId, dto.name);
  }

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.wallets.listWallets(user.userId);
  }

  @Post(":id/members")
  @WalletRoles(WalletRole.ADMIN)
  @UseGuards(JwtAuthGuard, WalletRoleGuard)
  addMember(@Param("id") walletId: string, @Body() dto: AddMemberDto) {
    return this.wallets.addMember(walletId, dto.email, dto.role);
  }
}
