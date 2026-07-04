-- CreateTable: durable "these are the same charge" memory written when a user
-- rejects a suspected date-drift duplicate. Keyed on the STABLE fields
-- (accountId, amount, currency, date), where `date` is the rejected movement's
-- own (now-stable, settled) date. It carries NO reference to the candidate — the
-- sync ladder checks this memory after exact-match but BEFORE fuzzy queuing, so a
-- movement matching (accountId, amount, currency) within ±3 days of a remembered
-- date is silently skipped instead of re-queued forever.
--   * accountId — cascading FK: dropping an account clears its rejection memory.
CREATE TABLE "RejectedDuplicate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT,
    "accountId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RejectedDuplicate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RejectedDuplicate_accountId_idx" ON "RejectedDuplicate"("accountId");
