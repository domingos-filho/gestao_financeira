import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { WalletRoles } from "../common/decorators/wallet-role.decorator";
import { WalletRoleGuard } from "../common/guards/wallet-role.guard";
import { WalletRole } from "@gf/shared";
import { DebtsService } from "./debts.service";
import { CreateDebtDto } from "./dto/create-debt.dto";
import { UpdateDebtDto } from "./dto/update-debt.dto";

@Controller("wallets/:walletId/debts")
@UseGuards(JwtAuthGuard, WalletRoleGuard)
export class DebtsController {
  constructor(private readonly debts: DebtsService) {}

  @Get()
  @WalletRoles(WalletRole.VIEWER)
  list(@Param("walletId") walletId: string) {
    return this.debts.list(walletId);
  }

  @Post()
  @WalletRoles(WalletRole.EDITOR)
  create(@Param("walletId") walletId: string, @Body() dto: CreateDebtDto) {
    return this.debts.create(walletId, dto);
  }

  @Patch(":debtId")
  @WalletRoles(WalletRole.EDITOR)
  update(
    @Param("walletId") walletId: string,
    @Param("debtId") debtId: string,
    @Body() dto: UpdateDebtDto
  ) {
    return this.debts.update(walletId, debtId, dto);
  }
}
