import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(walletId: string) {
    return this.prisma.category.findMany({
      where: { walletId },
      orderBy: { name: "asc" }
    });
  }

  async create(walletId: string, name: string) {
    const existing = await this.prisma.category.findFirst({
      where: { walletId, name: { equals: name, mode: "insensitive" } }
    });

    if (existing) {
      throw new ConflictException("Category already exists");
    }

    return this.prisma.category.create({
      data: { walletId, name }
    });
  }

  async update(walletId: string, categoryId: string, name?: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, walletId }
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    const nextName = name?.trim();
    if (nextName) {
      const duplicate = await this.prisma.category.findFirst({
        where: {
          walletId,
          name: { equals: nextName, mode: "insensitive" },
          NOT: { id: categoryId }
        }
      });
      if (duplicate) {
        throw new ConflictException("Category already exists");
      }
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data: nextName ? { name: nextName } : {}
    });
  }
}
