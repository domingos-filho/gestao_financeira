import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { WalletRoles } from "../common/decorators/wallet-role.decorator";
import { WalletRoleGuard } from "../common/guards/wallet-role.guard";
import { WalletRole } from "@gf/shared";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { DeleteCategoryDto } from "./dto/delete-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Controller("wallets/:walletId/categories")
@UseGuards(JwtAuthGuard, WalletRoleGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @WalletRoles(WalletRole.VIEWER)
  list(@Param("walletId") walletId: string) {
    return this.categories.list(walletId);
  }

  @Post()
  @WalletRoles(WalletRole.EDITOR)
  create(@Param("walletId") walletId: string, @Body() dto: CreateCategoryDto) {
    return this.categories.create(walletId, {
      name: dto.name,
      type: dto.type,
      color: dto.color,
      icon: dto.icon,
      sortOrder: dto.sortOrder
    });
  }

  @Post("seed")
  @WalletRoles(WalletRole.EDITOR)
  seed(@Param("walletId") walletId: string) {
    return this.categories.seedDefaults(walletId);
  }

  @Patch(":categoryId")
  @WalletRoles(WalletRole.EDITOR)
  update(
    @Param("walletId") walletId: string,
    @Param("categoryId") categoryId: string,
    @Body() dto: UpdateCategoryDto
  ) {
    return this.categories.update(walletId, categoryId, {
      name: dto.name,
      type: dto.type,
      color: dto.color,
      icon: dto.icon,
      sortOrder: dto.sortOrder,
      archived: dto.archived
    });
  }

  @Delete(":categoryId")
  @WalletRoles(WalletRole.EDITOR)
  remove(
    @Param("walletId") walletId: string,
    @Param("categoryId") categoryId: string,
    @Body() dto: DeleteCategoryDto
  ) {
    return this.categories.remove(walletId, categoryId, dto.reassignTo ?? null);
  }
}
