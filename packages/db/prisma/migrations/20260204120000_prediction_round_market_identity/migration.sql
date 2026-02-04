-- Add explicit market identity fields
ALTER TABLE "PredictionRound"
ADD COLUMN "conditionId" TEXT,
ADD COLUMN "marketId" TEXT,
ADD COLUMN "marketSlug" TEXT;

-- Backfill existing rows using available marketRef when present.
-- conditionId falls back to a deterministic pseudo-id for legacy rows.
UPDATE "PredictionRound"
SET
  "conditionId" = COALESCE(
    substring("marketRef" from '(0x[0-9A-Fa-f]{64})'),
    lower('0x' || md5("id") || md5("id"))
  ),
  "marketId" = COALESCE(NULLIF("marketRef", ''), "id"),
  "marketSlug" = COALESCE(NULLIF("marketRef", ''), "id"),
  "targetOutcome" = COALESCE("targetOutcome", 'UNKNOWN'),
  "targetTokenId" = COALESCE("targetTokenId", 'UNKNOWN');

ALTER TABLE "PredictionRound"
ALTER COLUMN "conditionId" SET NOT NULL,
ALTER COLUMN "marketId" SET NOT NULL,
ALTER COLUMN "marketSlug" SET NOT NULL,
ALTER COLUMN "targetOutcome" SET NOT NULL,
ALTER COLUMN "targetTokenId" SET NOT NULL;

-- marketRef is replaced by explicit fields.
ALTER TABLE "PredictionRound"
DROP COLUMN "marketRef";

CREATE INDEX "PredictionRound_conditionId_idx" ON "PredictionRound"("conditionId");
