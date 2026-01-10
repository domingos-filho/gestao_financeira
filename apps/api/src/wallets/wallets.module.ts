import { Module } from "@nestjs/common";
import { WalletsController } from "./wallets.controller";
import { WalletsService } from "./wallets.service";
import { AdminEmailGuard } from "../common/guards/admin-email.guard";

@Module({
  controllers: [WalletsController],
  providers: [WalletsService, AdminEmailGuard]
})
export class WalletsModule {}
