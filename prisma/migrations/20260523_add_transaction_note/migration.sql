-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "note" TEXT,
    "amount" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "isReimbursed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("accountId", "amount", "categoryId", "createdAt", "date", "description", "id", "isShared", "isReimbursed") SELECT "accountId", "amount", "categoryId", "createdAt", "date", "description", "id", "isShared", "isReimbursed" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
