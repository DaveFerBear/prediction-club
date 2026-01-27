import 'dotenv/config';
import { createChainPublicClient, ClubVaultV1Abi, type SupportedChainId } from '@prediction-club/chain';
import { prisma } from '@prediction-club/db';
import { sleep } from '@prediction-club/shared';
import { processVaultEvent } from './events';
import { INDEXER_CONFIG } from './config';

/**
 * Main indexer loop
 *
 * Polls for new events from all registered vaults and processes them
 */
async function main() {
  console.log('Starting indexer...');
  console.log(`Chain ID: ${INDEXER_CONFIG.chainId}`);
  console.log(`Poll interval: ${INDEXER_CONFIG.pollIntervalMs}ms`);
  console.log(`Batch size: ${INDEXER_CONFIG.batchSize}`);

  const client = createChainPublicClient(INDEXER_CONFIG.chainId as SupportedChainId);

  // Track last processed block per vault
  const lastBlocks = new Map<string, bigint>();

  while (true) {
    try {
      // Get all clubs on this chain
      const clubs = await prisma.club.findMany({
        where: { chainId: INDEXER_CONFIG.chainId },
        select: {
          id: true,
          vaultAddress: true,
          slug: true,
        },
      });

      if (clubs.length === 0) {
        console.log('No clubs found for this chain. Waiting...');
        await sleep(INDEXER_CONFIG.pollIntervalMs);
        continue;
      }

      // Get current block
      const currentBlock = await client.getBlockNumber();

      for (const club of clubs) {
        const vaultAddress = club.vaultAddress as `0x${string}`;

        // Get last processed block for this vault
        let fromBlock = lastBlocks.get(club.id);

        if (!fromBlock) {
          // Check DB for last processed event
          const lastEvent = await prisma.vaultEvent.findFirst({
            where: { clubId: club.id },
            orderBy: { blockNumber: 'desc' },
          });

          fromBlock = lastEvent
            ? BigInt(lastEvent.blockNumber) + 1n
            : BigInt(INDEXER_CONFIG.startBlock || currentBlock - 10000n);
        }

        // Don't query future blocks
        if (fromBlock > currentBlock) {
          continue;
        }

        // Limit batch size
        const toBlock =
          fromBlock + BigInt(INDEXER_CONFIG.batchSize) < currentBlock
            ? fromBlock + BigInt(INDEXER_CONFIG.batchSize)
            : currentBlock;

        console.log(`[${club.slug}] Fetching events from block ${fromBlock} to ${toBlock}`);

        // Fetch logs
        const logs = await client.getLogs({
          address: vaultAddress,
          events: ClubVaultV1Abi.filter((item) => item.type === 'event'),
          fromBlock,
          toBlock,
        });

        console.log(`[${club.slug}] Found ${logs.length} events`);

        // Process each event
        for (const log of logs) {
          // Get block timestamp
          const block = await client.getBlock({ blockNumber: log.blockNumber! });
          const blockTime = new Date(Number(block.timestamp) * 1000);

          await processVaultEvent(club.id, log, blockTime);
        }

        // Update last processed block
        lastBlocks.set(club.id, toBlock + 1n);
      }

      // Wait before next poll
      await sleep(INDEXER_CONFIG.pollIntervalMs);
    } catch (error) {
      console.error('Indexer error:', error);
      // Wait before retrying
      await sleep(INDEXER_CONFIG.pollIntervalMs * 2);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down indexer...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down indexer...');
  await prisma.$disconnect();
  process.exit(0);
});

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
