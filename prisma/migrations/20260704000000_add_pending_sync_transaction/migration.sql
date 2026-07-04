-- CreateTable: staging area for a scraped movement that looks like a possible
-- date-drift duplicate. Held here (NOT inserted as a Transaction) until the user
-- accepts it in the config review panel.
--   * accountId  — cascading FK: dropping an account clears its staged suspects.
--   * candidateId — LOOSE int, NO foreign key: deleting the candidate transaction
--                   must not cascade-delete the suspect.
--   * unique (accountId, amount, currency, date) — backstop against double-queuing.
--     SQLite treats each NULL currency as distinct, so CLP rows are not deduped by
--     this index; the sync route's application-level check is the real guard.
CREATE TABLE "PendingSyncTransaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT,
    "accountId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "candidateId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingSyncTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingSyncTransaction_accountId_amount_currency_date_key" ON "PendingSyncTransaction"("accountId", "amount", "currency", "date");

-- CreateIndex
CREATE INDEX "PendingSyncTransaction_accountId_idx" ON "PendingSyncTransaction"("accountId");
