-- 0005_wallet_snapshots
CREATE TABLE "WalletSnapshot" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "wallet_id" UUID NOT NULL REFERENCES "Wallet"("id") ON DELETE CASCADE,
  "last_server_seq" INTEGER NOT NULL,
  "state" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "WalletSnapshot_wallet_created_idx" ON "WalletSnapshot" ("wallet_id", "created_at");
