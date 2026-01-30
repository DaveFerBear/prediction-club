/*
  Warnings:

  - You are about to drop the column `polymarketConditionId` on the `PredictionRound` table. All the data in the column will be lost.
  - You are about to drop the column `polymarketInitialYesPrice` on the `PredictionRound` table. All the data in the column will be lost.
  - You are about to drop the column `polymarketMarketUrl` on the `PredictionRound` table. All the data in the column will be lost.
  - You are about to drop the column `polymarketOutcomeNoToken` on the `PredictionRound` table. All the data in the column will be lost.
  - You are about to drop the column `polymarketOutcomeYesToken` on the `PredictionRound` table. All the data in the column will be lost.
  - You are about to drop the column `polymarketResolvedAt` on the `PredictionRound` table. All the data in the column will be lost.
  - You are about to drop the column `polymarketSettlementYesPrice` on the `PredictionRound` table. All the data in the column will be lost.
  - You are about to drop the column `polymarketWinningOutcome` on the `PredictionRound` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DEPOSIT', 'COMMIT', 'PAYOUT', 'WITHDRAW', 'ADJUSTMENT');

-- DropIndex
DROP INDEX "PredictionRound_polymarketConditionId_idx";

-- AlterTable
ALTER TABLE "PredictionRound" DROP COLUMN "polymarketConditionId",
DROP COLUMN "polymarketInitialYesPrice",
DROP COLUMN "polymarketMarketUrl",
DROP COLUMN "polymarketOutcomeNoToken",
DROP COLUMN "polymarketOutcomeYesToken",
DROP COLUMN "polymarketResolvedAt",
DROP COLUMN "polymarketSettlementYesPrice",
DROP COLUMN "polymarketWinningOutcome";

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "safeAddress" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "predictionRoundId" TEXT,
    "type" "LedgerEntryType" NOT NULL,
    "amount" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "txHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerEntry_safeAddress_idx" ON "LedgerEntry"("safeAddress");

-- CreateIndex
CREATE INDEX "LedgerEntry_clubId_idx" ON "LedgerEntry"("clubId");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_idx" ON "LedgerEntry"("userId");

-- CreateIndex
CREATE INDEX "LedgerEntry_predictionRoundId_idx" ON "LedgerEntry"("predictionRoundId");

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_predictionRoundId_fkey" FOREIGN KEY ("predictionRoundId") REFERENCES "PredictionRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
