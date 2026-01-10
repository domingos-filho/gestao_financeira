import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminEmailGuard } from "../common/guards/admin-email.guard";
import { UsersService } from "./users.service";
import { CreateManagedUserDto } from "./dto/create-managed-user.dto";
import { UpdateManagedUserDto } from "./dto/update-managed-user.dto";

@Controller("users")
@UseGuards(JwtAuthGuard, AdminEmailGuard)
export class UsersAdminController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.listUsers();
  }

  @Post()
  create(@Body() dto: CreateManagedUserDto) {
    return this.users.createManagedUser(dto);
  }

  @Patch(":id")
  update(@Param("id") userId: string, @Body() dto: UpdateManagedUserDto) {
    return this.users.updateManagedUser(userId, dto);
  }

  @Delete(":id")
  remove(@Param("id") userId: string) {
    return this.users.deleteManagedUser(userId);
  }
}
