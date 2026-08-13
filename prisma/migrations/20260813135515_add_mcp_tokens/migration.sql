-- CreateTable
CREATE TABLE "McpToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "lastFour" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "McpToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "McpToken_tokenHash_key" ON "McpToken"("tokenHash");

-- CreateIndex
CREATE INDEX "McpToken_householdId_idx" ON "McpToken"("householdId");

-- CreateIndex
CREATE INDEX "McpToken_userId_idx" ON "McpToken"("userId");

-- AddForeignKey
ALTER TABLE "McpToken" ADD CONSTRAINT "McpToken_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpToken" ADD CONSTRAINT "McpToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
