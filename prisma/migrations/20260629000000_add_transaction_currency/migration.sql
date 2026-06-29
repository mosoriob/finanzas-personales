-- AlterTable: add the native-currency marker. NULL means CLP (no backfill
-- needed — existing rows are pesos). Only "USD" or NULL are ever written.
ALTER TABLE "Transaction" ADD COLUMN "currency" TEXT;
