-- 0004_category_structure
CREATE TYPE "CategoryType" AS ENUM ('INCOME', 'EXPENSE');

ALTER TABLE "Category"
  ADD COLUMN "type" "CategoryType" NOT NULL DEFAULT 'EXPENSE',
  ADD COLUMN "color" TEXT NOT NULL DEFAULT '#4fa2ff',
  ADD COLUMN "icon" TEXT NOT NULL DEFAULT 'tag',
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "archived_at" TIMESTAMP(3) NULL;

CREATE INDEX "Category_wallet_type_sort_idx" ON "Category" ("wallet_id", "type", "sort_order");
