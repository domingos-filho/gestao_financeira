import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CategoryType } from "@gf/shared";
import { DEFAULT_CATEGORIES } from "./default-categories";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private defaultColor(type: CategoryType) {
    return type === CategoryType.INCOME ? "#11cc95" : "#e96878";
  }

  list(walletId: string) {
    return this.prisma.category.findMany({
      where: { walletId },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
    });
  }

  async create(
    walletId: string,
    params: { name: string; type: CategoryType; color?: string; icon?: string; sortOrder?: number }
  ) {
    const trimmedName = params.name.trim();
    const type = params.type ?? CategoryType.EXPENSE;
    const existing = await this.prisma.category.findFirst({
      where: { walletId, type, name: { equals: trimmedName, mode: "insensitive" } }
    });

    if (existing) {
      throw new ConflictException("Category already exists");
    }

    let sortOrder = params.sortOrder;
    if (sortOrder === undefined) {
      const max = await this.prisma.category.aggregate({
        where: { walletId, type },
        _max: { sortOrder: true }
      });
      sortOrder = (max._max.sortOrder ?? 0) + 1;
    }

    return this.prisma.category.create({
      data: {
        walletId,
        name: trimmedName,
        type,
        color: params.color ?? this.defaultColor(type),
        icon: params.icon ?? "tag",
        sortOrder
      }
    });
  }

  async update(
    walletId: string,
    categoryId: string,
    params: {
      name?: string;
      type?: CategoryType;
      color?: string;
      icon?: string;
      sortOrder?: number;
      archived?: boolean;
    }
  ) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, walletId }
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    const nextName = params.name?.trim() ?? category.name;
    const nextType = params.type ?? category.type;
    const duplicate = await this.prisma.category.findFirst({
      where: {
        walletId,
        type: nextType,
        name: { equals: nextName, mode: "insensitive" },
        NOT: { id: categoryId }
      }
    });
    if (duplicate) {
      throw new ConflictException("Category already exists");
    }

    const data: {
      name?: string;
      type?: CategoryType;
      color?: string;
      icon?: string;
      sortOrder?: number;
      archivedAt?: Date | null;
    } = {};

    if (params.name) {
      data.name = params.name.trim();
    }
    if (params.type) {
      data.type = params.type;
    }
    if (params.color) {
      data.color = params.color;
    }
    if (params.icon) {
      data.icon = params.icon;
    }
    if (params.sortOrder !== undefined) {
      data.sortOrder = params.sortOrder;
    }

    if (params.archived === true) {
      data.archivedAt = new Date();
    } else if (params.archived === false) {
      data.archivedAt = null;
    }

    if (params.type && params.type !== category.type && params.sortOrder === undefined) {
      const max = await this.prisma.category.aggregate({
        where: { walletId, type: params.type },
        _max: { sortOrder: true }
      });
      data.sortOrder = (max._max.sortOrder ?? 0) + 1;
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data
    });
  }

  async remove(walletId: string, categoryId: string, reassignTo?: string | null) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, walletId }
    });
    if (!category) {
      throw new NotFoundException("Category not found");
    }

    if (reassignTo && reassignTo === categoryId) {
      throw new BadRequestException("Invalid reassignment");
    }

    if (reassignTo) {
      const target = await this.prisma.category.findFirst({
        where: { id: reassignTo, walletId, archivedAt: null }
      });
      if (!target) {
        throw new NotFoundException("Target category not found");
      }
    }

    await this.prisma.transaction.updateMany({
      where: { walletId, categoryId },
      data: { categoryId: reassignTo ?? null }
    });

    return this.prisma.category.delete({ where: { id: categoryId } });
  }

  async seedDefaults(walletId: string) {
    const count = await this.prisma.category.count({ where: { walletId } });
    if (count > 0) {
      return { created: 0 };
    }

    await this.prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((category) => ({
        ...category,
        walletId
      }))
    });

    return { created: DEFAULT_CATEGORIES.length };
  }
}
