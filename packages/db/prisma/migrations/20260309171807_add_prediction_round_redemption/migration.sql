-- AlterEnum
ALTER TYPE "PredictionRoundStatus" ADD VALUE 'RESOLVED';

-- AlterTable
ALTER TABLE "PredictionRound" ADD COLUMN     "redemptionError" TEXT;

-- AlterTable
ALTER TABLE "PredictionRoundMember" ADD COLUMN     "redeemedAmount" TEXT NOT NULL DEFAULT '0',
ADD COLUMN     "redeemedAt" TIMESTAMP(3),
ADD COLUMN     "redemptionError" TEXT,
ADD COLUMN     "redemptionTxHash" TEXT;

