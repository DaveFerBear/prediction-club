-- AlterTable
ALTER TABLE "PredictionRound" ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "settledAt" TIMESTAMP(3),
ADD COLUMN     "targetOutcome" TEXT,
ADD COLUMN     "targetTokenId" TEXT;

-- AlterTable
ALTER TABLE "PredictionRoundMember" ADD COLUMN     "orderCreatedAt" TIMESTAMP(3),
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "orderMakingAmount" TEXT,
ADD COLUMN     "orderOutcome" TEXT,
ADD COLUMN     "orderPrice" TEXT,
ADD COLUMN     "orderSide" TEXT,
ADD COLUMN     "orderSize" TEXT,
ADD COLUMN     "orderSizeMatched" TEXT,
ADD COLUMN     "orderStatus" TEXT,
ADD COLUMN     "orderTakingAmount" TEXT,
ADD COLUMN     "orderTxHashes" JSONB,
ADD COLUMN     "orderType" TEXT,
ADD COLUMN     "settledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PredictionRound_targetTokenId_idx" ON "PredictionRound"("targetTokenId");

-- CreateIndex
CREATE INDEX "PredictionRoundMember_orderId_idx" ON "PredictionRoundMember"("orderId");
