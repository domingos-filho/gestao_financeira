import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminEmailGuard } from "../common/guards/admin-email.guard";
import { UsersService } from "./users.service";
import { AccessGrantDto } from "./dto/access-grant.dto";

@Controller("users/access")
@UseGuards(JwtAuthGuard, AdminEmailGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.listAccess();
  }

  @Post()
  grant(@Body() dto: AccessGrantDto) {
    return this.users.grantAccess(dto.email);
  }

  @Delete(":email")
  revoke(@Param("email") email: string) {
    return this.users.revokeAccess(email);
  }
}
