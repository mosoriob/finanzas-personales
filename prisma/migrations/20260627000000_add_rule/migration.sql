-- CreateTable
CREATE TABLE "Rule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "match" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Rule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Rule_categoryId_idx" ON "Rule"("categoryId");

-- CreateIndex
-- Case-insensitive uniqueness on `match`: two rules may not differ only by casing.
CREATE UNIQUE INDEX "Rule_match_key" ON "Rule"("match" COLLATE NOCASE);
