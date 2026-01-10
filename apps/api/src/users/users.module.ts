import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { UsersAdminController } from "./users-admin.controller";
import { AdminEmailGuard } from "../common/guards/admin-email.guard";

@Module({
  controllers: [UsersController, UsersAdminController],
  providers: [UsersService, AdminEmailGuard],
  exports: [UsersService]
})
export class UsersModule {}
