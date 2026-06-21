-- 0006_recurring_expenses
ALTER TYPE "SyncEventType" ADD VALUE IF NOT EXISTS 'RECURRING_EXPENSE_CREATED';
ALTER TYPE "SyncEventType" ADD VALUE IF NOT EXISTS 'RECURRING_EXPENSE_UPDATED';
ALTER TYPE "SyncEventType" ADD VALUE IF NOT EXISTS 'RECURRING_EXPENSE_DELETED';

CREATE TABLE "RecurringExpense" (
  "id" UUID PRIMARY KEY,
  "wallet_id" UUID NOT NULL REFERENCES "Wallet"("id") ON DELETE CASCADE,
  "account_id" UUID NOT NULL REFERENCES "Account"("id") ON DELETE RESTRICT,
  "description" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "category_id" UUID REFERENCES "Category"("id") ON DELETE SET NULL,
  "day_of_month" INTEGER NOT NULL,
  "start_month" TEXT NOT NULL,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Transaction"
  ADD COLUMN "recurring_expense_id" UUID,
  ADD COLUMN "recurring_month" TEXT;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_recurring_expense_id_fkey"
    FOREIGN KEY ("recurring_expense_id")
    REFERENCES "RecurringExpense"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

CREATE INDEX "RecurringExpense_wallet_archived_idx" ON "RecurringExpense" ("wallet_id", "archived_at");
CREATE INDEX "RecurringExpense_wallet_start_month_idx" ON "RecurringExpense" ("wallet_id", "start_month");
CREATE INDEX "Transaction_wallet_recurring_month_idx" ON "Transaction" ("wallet_id", "recurring_month");
CREATE UNIQUE INDEX "Transaction_recurring_expense_id_recurring_month_key"
  ON "Transaction" ("recurring_expense_id", "recurring_month");
