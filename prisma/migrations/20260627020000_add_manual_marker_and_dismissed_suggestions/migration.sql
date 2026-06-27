-- AlterTable: add the manual-categorization marker.
ALTER TABLE "Transaction" ADD COLUMN "manuallySet" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: dismissed suggestions, keyed on (match, categoryId).
CREATE TABLE "DismissedSuggestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "match" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "DismissedSuggestion_match_categoryId_key" ON "DismissedSuggestion"("match", "categoryId");

-- One-time backfill: a transaction in a non-"Otro" category that matches no
-- existing rule can only have been categorized by hand in this system. This
-- mirrors the pure `isManualByInference` helper (matchCategory returns null iff
-- no rule's trimmed match is a case-insensitive substring of the description).
UPDATE "Transaction"
SET "manuallySet" = true
WHERE "categoryId" <> (SELECT "id" FROM "Category" WHERE "name" = 'Otro')
  AND NOT EXISTS (
    SELECT 1 FROM "Rule"
    WHERE length(trim("Rule"."match")) > 0
      AND instr(lower("Transaction"."description"), lower(trim("Rule"."match"))) > 0
  );
