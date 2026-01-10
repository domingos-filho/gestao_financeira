import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { WalletRoles } from "../common/decorators/wallet-role.decorator";
import { AdminEmailGuard } from "../common/guards/admin-email.guard";
import { WalletRoleGuard } from "../common/guards/wallet-role.guard";
import { WalletRole } from "@gf/shared";
import { CreateWalletDto } from "./dto/create-wallet.dto";
import { AddMemberDto } from "./dto/add-member.dto";
import { UpdateWalletDto } from "./dto/update-wallet.dto";
import { WalletsService } from "./wallets.service";

@Controller("wallets")
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminEmailGuard)
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateWalletDto) {
    return this.wallets.createWallet(user.userId, dto.name);
  }

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.wallets.listWallets(user.userId);
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, AdminEmailGuard)
  listAll() {
    return this.wallets.listAllWallets();
  }

  @Post(":id/members")
  @WalletRoles(WalletRole.ADMIN)
  @UseGuards(JwtAuthGuard, WalletRoleGuard)
  addMember(@Param("id") walletId: string, @Body() dto: AddMemberDto) {
    return this.wallets.addMember(walletId, dto.email, dto.role);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, AdminEmailGuard)
  update(@Param("id") walletId: string, @Body() dto: UpdateWalletDto) {
    return this.wallets.updateWallet(walletId, dto.name);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, AdminEmailGuard)
  remove(@Param("id") walletId: string) {
    return this.wallets.deleteWallet(walletId);
  }
}
