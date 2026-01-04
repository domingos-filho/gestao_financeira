import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { AdminEmailGuard } from "../common/guards/admin-email.guard";

@Module({
  controllers: [UsersController],
  providers: [UsersService, AdminEmailGuard],
  exports: [UsersService]
})
export class UsersModule {}
