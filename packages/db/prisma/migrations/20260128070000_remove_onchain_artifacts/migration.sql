/*
  Warnings:

  - You are about to drop the column `cohortId` on the `PredictionRound` table. All the data in the column will be lost.
  - You are about to drop the column `commitTxHash` on the `PredictionRound` table. All the data in the column will be lost.
  - You are about to drop the column `settleTxHash` on the `PredictionRound` table. All the data in the column will be lost.
  - You are about to drop the column `executedTxHash` on the `PredictionRound` table. All the data in the column will be lost.
  - You are about to drop the `VaultEvent` table. If the table is not empty, all the data it contains will be lost.
*/

-- DropIndex
DROP INDEX "PredictionRound_clubId_cohortId_key";

-- AlterTable
ALTER TABLE "PredictionRound" DROP COLUMN "cohortId",
DROP COLUMN "commitTxHash",
DROP COLUMN "settleTxHash",
DROP COLUMN "executedTxHash";

-- DropTable
DROP TABLE "VaultEvent";
