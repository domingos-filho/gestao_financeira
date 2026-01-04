import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDebtDto } from "./dto/create-debt.dto";
import { UpdateDebtDto } from "./dto/update-debt.dto";

@Injectable()
export class DebtsService {
  constructor(private readonly prisma: PrismaService) {}

  list(walletId: string) {
    return this.prisma.debt.findMany({
      where: { walletId },
      orderBy: { startedAt: "desc" }
    });
  }

  create(walletId: string, dto: CreateDebtDto) {
    return this.prisma.debt.create({
      data: {
        walletId,
        name: dto.name.trim(),
        principalCents: dto.principalCents,
        interestRate: dto.interestRate ?? null,
        monthlyPaymentCents: dto.monthlyPaymentCents ?? null,
        startedAt: new Date(dto.startedAt),
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null
      }
    });
  }

  async update(walletId: string, debtId: string, dto: UpdateDebtDto) {
    const existing = await this.prisma.debt.findFirst({
      where: { id: debtId, walletId }
    });

    if (!existing) {
      throw new NotFoundException("Debt not found");
    }

    return this.prisma.debt.update({
      where: { id: debtId },
      data: {
        name: dto.name?.trim() ?? undefined,
        principalCents: dto.principalCents,
        interestRate: dto.interestRate ?? undefined,
        monthlyPaymentCents: dto.monthlyPaymentCents ?? undefined,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        status: dto.status ?? undefined
      }
    });
  }
}
