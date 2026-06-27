const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const adminEmail = (process.env.ADMIN_EMAIL || "fadomingosf@gmail.com").toLowerCase();
const walletName = process.env.E2E_WALLET_NAME || "Familia Domingos";
const loginPassword = process.env.ADMIN_PASSWORD || process.env.E2E_LOGIN_PASSWORD || "secret123";

async function resetDatabase() {
  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany();
    await tx.syncEvent.deleteMany();
    await tx.walletSnapshot.deleteMany();
    await tx.transaction.deleteMany();
    await tx.debt.deleteMany();
    await tx.category.deleteMany();
    await tx.account.deleteMany();
    await tx.walletMember.deleteMany();
    await tx.wallet.deleteMany();
    await tx.accessGrant.deleteMany();
    await tx.user.deleteMany();
  });
}

async function seed() {
  await resetDatabase();

  const passwordHash = await bcrypt.hash(loginPassword, 12);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: "Administrador",
        email: adminEmail,
        passwordHash,
        role: "ADMIN"
      }
    });

    const wallet = await tx.wallet.create({
      data: {
        name: walletName,
        createdById: user.id
      }
    });

    await tx.walletMember.create({
      data: {
        walletId: wallet.id,
        userId: user.id,
        role: "ADMIN"
      }
    });

    await tx.account.create({
      data: {
        walletId: wallet.id,
        name: "Conta principal"
      }
    });

    await tx.accessGrant.create({
      data: {
        email: adminEmail,
        status: "ALLOWED"
      }
    });

    return { user, wallet };
  });

  await prisma.$disconnect();
  return result;
}

if (require.main === module) {
  seed().catch(async (error) => {
    console.error(error);
    await prisma.$disconnect().catch(() => null);
    process.exit(1);
  });
}

module.exports = { seed };
