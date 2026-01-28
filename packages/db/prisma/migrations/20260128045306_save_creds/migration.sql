/*
  Warnings:

  - You are about to drop the column `chainId` on the `Club` table. All the data in the column will be lost.
  - You are about to drop the column `safeAddress` on the `Club` table. All the data in the column will be lost.
  - You are about to drop the column `vaultAddress` on the `Club` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[polymarketSafeAddress]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Club_chainId_safeAddress_key";

-- DropIndex
DROP INDEX "Club_chainId_vaultAddress_key";

-- AlterTable
ALTER TABLE "Club" DROP COLUMN "chainId",
DROP COLUMN "safeAddress",
DROP COLUMN "vaultAddress";

-- AlterTable
ALTER TABLE "PredictionRound" ADD COLUMN     "polymarketConditionId" TEXT,
ADD COLUMN     "polymarketInitialYesPrice" TEXT,
ADD COLUMN     "polymarketMarketUrl" TEXT,
ADD COLUMN     "polymarketOutcomeNoToken" TEXT,
ADD COLUMN     "polymarketOutcomeYesToken" TEXT,
ADD COLUMN     "polymarketResolvedAt" TIMESTAMP(3),
ADD COLUMN     "polymarketSettlementYesPrice" TEXT,
ADD COLUMN     "polymarketWinningOutcome" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "polymarketApiKeyId" TEXT,
ADD COLUMN     "polymarketApiPassphrase" TEXT,
ADD COLUMN     "polymarketApiSecret" TEXT,
ADD COLUMN     "polymarketSafeAddress" TEXT;

-- CreateIndex
CREATE INDEX "PredictionRound_polymarketConditionId_idx" ON "PredictionRound"("polymarketConditionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_polymarketSafeAddress_key" ON "User"("polymarketSafeAddress");
