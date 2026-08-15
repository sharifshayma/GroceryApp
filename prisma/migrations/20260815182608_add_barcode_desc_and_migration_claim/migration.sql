-- AlterTable
ALTER TABLE "PriceHistory" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "MigrationClaim" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'member',
    "language" "Language" NOT NULL DEFAULT 'en',
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MigrationClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MigrationClaim_email_key" ON "MigrationClaim"("email");

-- CreateIndex
CREATE INDEX "MigrationClaim_householdId_idx" ON "MigrationClaim"("householdId");

-- AddForeignKey
ALTER TABLE "MigrationClaim" ADD CONSTRAINT "MigrationClaim_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
