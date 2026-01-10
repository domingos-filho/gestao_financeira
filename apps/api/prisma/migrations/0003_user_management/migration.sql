-- 0003_user_management
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

ALTER TABLE "User"
  ADD COLUMN "name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
  ADD COLUMN "default_wallet_id" UUID NULL;

ALTER TABLE "User"
  ADD CONSTRAINT "User_default_wallet_id_fkey"
  FOREIGN KEY ("default_wallet_id") REFERENCES "Wallet"("id") ON DELETE SET NULL;

UPDATE "User"
SET "role" = 'ADMIN'
WHERE LOWER("email") = 'fadomingosf@gmail.com';
