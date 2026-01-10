import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersAdminController } from "./users-admin.controller";
import { AdminEmailGuard } from "../common/guards/admin-email.guard";

@Module({
  controllers: [UsersAdminController],
  providers: [UsersService, AdminEmailGuard],
  exports: [UsersService]
})
export class UsersModule {}
