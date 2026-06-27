-- CreateTable
CREATE TABLE "Rule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "match" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Rule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
-- Case-insensitive uniqueness on the match text: "Jumbo" and "JUMBO" collide.
CREATE UNIQUE INDEX "Rule_match_key" ON "Rule"("match" COLLATE NOCASE);

-- CreateIndex
CREATE INDEX "Rule_categoryId_idx" ON "Rule"("categoryId");
