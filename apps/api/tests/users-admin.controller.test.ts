import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ExpressAdapter } from "@nestjs/platform-express";
import { UserRole } from "@gf/shared";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminEmailGuard } from "../src/common/guards/admin-email.guard";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard";
import { UsersAdminController } from "../src/users/users-admin.controller";
import { UsersService } from "../src/users/users.service";

describe("UsersAdminController", () => {
  const usersService = {
    listWalletOptions: vi.fn().mockResolvedValue([{ id: "wallet-1", name: "Carteira principal" }]),
    createManagedUser: vi.fn().mockResolvedValue({
      id: "user-1",
      name: "Maria",
      email: "maria@example.com",
      role: UserRole.MEMBER,
      defaultWallet: { id: "wallet-1", name: "Carteira principal" }
    }),
    updateManagedUser: vi.fn(),
    deleteManagedUser: vi.fn()
  };

  let app: import("@nestjs/common").INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersAdminController],
      providers: [{ provide: UsersService, useValue: usersService }]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminEmailGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication(new ExpressAdapter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true
      })
    );
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    vi.clearAllMocks();
  });

  it("lists wallet options through HTTP", async () => {
    await request(app.getHttpServer())
      .get("/users/wallet-options")
      .expect(200)
      .expect([{ id: "wallet-1", name: "Carteira principal" }]);

    expect(usersService.listWalletOptions).toHaveBeenCalledTimes(1);
  });

  it("creates a managed user through HTTP", async () => {
    await request(app.getHttpServer())
      .post("/users")
      .send({
        name: "Maria",
        email: "maria@example.com",
        password: "secret123",
        role: UserRole.MEMBER,
        walletId: "550e8400-e29b-41d4-a716-446655440000"
      })
      .expect(201)
      .expect({
        id: "user-1",
        name: "Maria",
        email: "maria@example.com",
        role: UserRole.MEMBER,
        defaultWallet: { id: "wallet-1", name: "Carteira principal" }
      });

    expect(usersService.createManagedUser).toHaveBeenCalledTimes(1);
  });
});
