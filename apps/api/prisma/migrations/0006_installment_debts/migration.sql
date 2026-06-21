-- 0006_installment_debts
ALTER TABLE "Debt"
  ADD COLUMN "installment_count" INTEGER NULL;
