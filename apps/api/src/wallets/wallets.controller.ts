import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { AdminEmailGuard } from "../common/guards/admin-email.guard";
import { CreateWalletDto } from "./dto/create-wallet.dto";
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
