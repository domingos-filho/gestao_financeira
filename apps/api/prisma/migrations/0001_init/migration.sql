-- 0001_init
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "WalletRole" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');
CREATE TYPE "SyncEventType" AS ENUM ('TRANSACTION_CREATED', 'TRANSACTION_UPDATED', 'TRANSACTION_DELETED');

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Wallet" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "created_by_id" UUID NOT NULL REFERENCES "User"("id"),
  "server_seq" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "WalletMember" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "wallet_id" UUID NOT NULL REFERENCES "Wallet"("id"),
  "user_id" UUID NOT NULL REFERENCES "User"("id"),
  "role" "WalletRole" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("wallet_id", "user_id")
);

CREATE TABLE "Account" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "wallet_id" UUID NOT NULL REFERENCES "Wallet"("id"),
  "name" TEXT NOT NULL,
  "type" TEXT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Category" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "wallet_id" UUID NOT NULL REFERENCES "Wallet"("id"),
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Transaction" (
  "id" UUID PRIMARY KEY,
  "wallet_id" UUID NOT NULL REFERENCES "Wallet"("id"),
  "account_id" UUID NOT NULL REFERENCES "Account"("id"),
  "type" "TransactionType" NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "category_id" UUID NULL REFERENCES "Category"("id"),
  "counterparty_account_id" UUID NULL REFERENCES "Account"("id"),
  "deleted_at" TIMESTAMP(3) NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SyncEvent" (
  "event_id" UUID PRIMARY KEY,
  "wallet_id" UUID NOT NULL REFERENCES "Wallet"("id"),
  "user_id" UUID NOT NULL REFERENCES "User"("id"),
  "device_id" TEXT NOT NULL,
  "event_type" "SyncEventType" NOT NULL,
  "payload" JSONB NOT NULL,
  "server_seq" INTEGER NOT NULL,
  "server_received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SyncEvent_wallet_seq_idx" ON "SyncEvent" ("wallet_id", "server_seq");
CREATE INDEX "SyncEvent_wallet_received_idx" ON "SyncEvent" ("wallet_id", "server_received_at");

CREATE TABLE "RefreshToken" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "User"("id"),
  "token_hash" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "revoked_at" TIMESTAMP(3) NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "RefreshToken_user_device_idx" ON "RefreshToken" ("user_id", "device_id");
