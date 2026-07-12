-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BrandProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'company',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BrandProject" ("brandName", "createdAt", "id", "industry", "name", "updatedAt") SELECT "brandName", "createdAt", "id", "industry", "name", "updatedAt" FROM "BrandProject";
DROP TABLE "BrandProject";
ALTER TABLE "new_BrandProject" RENAME TO "BrandProject";
CREATE TABLE "new_PromptTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'company',
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "brandProjectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromptTemplate_brandProjectId_fkey" FOREIGN KEY ("brandProjectId") REFERENCES "BrandProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PromptTemplate" ("brandProjectId", "category", "createdAt", "id", "isDefault", "text") SELECT "brandProjectId", "category", "createdAt", "id", "isDefault", "text" FROM "PromptTemplate";
DROP TABLE "PromptTemplate";
ALTER TABLE "new_PromptTemplate" RENAME TO "PromptTemplate";
CREATE INDEX "PromptTemplate_brandProjectId_idx" ON "PromptTemplate"("brandProjectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
