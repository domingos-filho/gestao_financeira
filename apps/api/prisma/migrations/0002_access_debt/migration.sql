-- 0002_access_debt
CREATE TYPE "AccessStatus" AS ENUM ('ALLOWED', 'REVOKED');
CREATE TYPE "DebtStatus" AS ENUM ('ACTIVE', 'PAID', 'CANCELED');

CREATE TABLE "AccessGrant" (
  "email" TEXT PRIMARY KEY,
  "status" "AccessStatus" NOT NULL DEFAULT 'ALLOWED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Debt" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "wallet_id" UUID NOT NULL REFERENCES "Wallet"("id"),
  "name" TEXT NOT NULL,
  "principal_cents" INTEGER NOT NULL,
  "interest_rate" DOUBLE PRECISION NULL,
  "monthly_payment_cents" INTEGER NULL,
  "started_at" TIMESTAMP(3) NOT NULL,
  "due_at" TIMESTAMP(3) NULL,
  "status" "DebtStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "Debt_wallet_idx" ON "Debt" ("wallet_id");
