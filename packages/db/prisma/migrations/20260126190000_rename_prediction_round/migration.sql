-- Rename Cohort -> PredictionRound

BEGIN;

ALTER TYPE "CohortStatus" RENAME TO "PredictionRoundStatus";

ALTER TABLE "Cohort" RENAME TO "PredictionRound";
ALTER TABLE "CohortMember" RENAME TO "PredictionRoundMember";

ALTER TABLE "PredictionRoundMember" RENAME COLUMN "cohortId" TO "predictionRoundId";

ALTER TABLE "PredictionRound" RENAME CONSTRAINT "Cohort_pkey" TO "PredictionRound_pkey";
ALTER TABLE "PredictionRoundMember" RENAME CONSTRAINT "CohortMember_pkey" TO "PredictionRoundMember_pkey";

ALTER TABLE "PredictionRound" RENAME CONSTRAINT "Cohort_clubId_fkey" TO "PredictionRound_clubId_fkey";
ALTER TABLE "PredictionRoundMember" RENAME CONSTRAINT "CohortMember_cohortId_fkey" TO "PredictionRoundMember_predictionRoundId_fkey";
ALTER TABLE "PredictionRoundMember" RENAME CONSTRAINT "CohortMember_userId_fkey" TO "PredictionRoundMember_userId_fkey";

ALTER INDEX "Cohort_clubId_cohortId_key" RENAME TO "PredictionRound_clubId_predictionRoundId_key";
ALTER INDEX "Cohort_clubId_idx" RENAME TO "PredictionRound_clubId_idx";
ALTER INDEX "Cohort_status_idx" RENAME TO "PredictionRound_status_idx";

ALTER INDEX "CohortMember_cohortId_userId_key" RENAME TO "PredictionRoundMember_predictionRoundId_userId_key";
ALTER INDEX "CohortMember_cohortId_idx" RENAME TO "PredictionRoundMember_predictionRoundId_idx";
ALTER INDEX "CohortMember_userId_idx" RENAME TO "PredictionRoundMember_userId_idx";

COMMIT;
