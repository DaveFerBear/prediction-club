/*
  Warnings:

  - You are about to drop the column `managerUserId` on the `Club` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Club" DROP CONSTRAINT "Club_managerUserId_fkey";

-- DropIndex
DROP INDEX "Club_managerUserId_idx";

-- AlterTable
ALTER TABLE "Club" DROP COLUMN "managerUserId",
ADD COLUMN     "createdByUserId" TEXT;

-- AlterTable
ALTER TABLE "PredictionRound" ADD COLUMN     "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Club_createdByUserId_idx" ON "Club"("createdByUserId");

-- CreateIndex
CREATE INDEX "PredictionRound_createdByUserId_idx" ON "PredictionRound"("createdByUserId");

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionRound" ADD CONSTRAINT "PredictionRound_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
