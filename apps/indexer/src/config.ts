import { indexerEnvSchema, validateEnv } from '@prediction-club/shared';

export const config = validateEnv(indexerEnvSchema);

export const INDEXER_CONFIG = {
  chainId: config.INDEXER_CHAIN_ID,
  pollIntervalMs: config.INDEXER_POLL_INTERVAL_MS,
  batchSize: config.INDEXER_BATCH_SIZE,
  startBlock: config.INDEXER_START_BLOCK,
};
