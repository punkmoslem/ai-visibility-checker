-- CreateTable
CREATE TABLE "BrandProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandProjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Competitor_brandProjectId_fkey" FOREIGN KEY ("brandProjectId") REFERENCES "BrandProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "brandProjectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromptTemplate_brandProjectId_fkey" FOREIGN KEY ("brandProjectId") REFERENCES "BrandProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandProjectId" TEXT NOT NULL,
    "promptTemplateId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectPrompt_brandProjectId_fkey" FOREIGN KEY ("brandProjectId") REFERENCES "BrandProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectPrompt_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "PromptTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandProjectId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "nextRunAt" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Schedule_brandProjectId_fkey" FOREIGN KEY ("brandProjectId") REFERENCES "BrandProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandProjectId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "Run_brandProjectId_fkey" FOREIGN KEY ("brandProjectId") REFERENCES "BrandProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "promptTemplateId" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "aiTool" TEXT NOT NULL,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "rawResponse" TEXT NOT NULL,
    "brandMentioned" BOOLEAN NOT NULL,
    "sentiment" TEXT NOT NULL,
    "rankPosition" INTEGER,
    "citedSources" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompetitorMention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runResultId" TEXT NOT NULL,
    "competitorName" TEXT NOT NULL,
    "mentioned" BOOLEAN NOT NULL,
    "rankPosition" INTEGER,
    CONSTRAINT "CompetitorMention_runResultId_fkey" FOREIGN KEY ("runResultId") REFERENCES "RunResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Competitor_brandProjectId_idx" ON "Competitor"("brandProjectId");

-- CreateIndex
CREATE INDEX "PromptTemplate_brandProjectId_idx" ON "PromptTemplate"("brandProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPrompt_brandProjectId_promptTemplateId_key" ON "ProjectPrompt"("brandProjectId", "promptTemplateId");

-- CreateIndex
CREATE INDEX "Schedule_brandProjectId_idx" ON "Schedule"("brandProjectId");

-- CreateIndex
CREATE INDEX "Run_brandProjectId_idx" ON "Run"("brandProjectId");

-- CreateIndex
CREATE INDEX "RunResult_runId_idx" ON "RunResult"("runId");

-- CreateIndex
CREATE INDEX "CompetitorMention_runResultId_idx" ON "CompetitorMention"("runResultId");
