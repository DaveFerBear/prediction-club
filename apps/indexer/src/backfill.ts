/**
 * Backfill CLI
 *
 * Usage:
 *   yarn indexer:backfill --club <slug> --from <block> [--to <block>]
 *
 * Example:
 *   yarn indexer:backfill --club alpha-traders --from 50000000
 */

import {
  createChainPublicClient,
  ClubVaultV1Abi,
  type SupportedChainId,
} from '@prediction-club/chain';
import { prisma } from '@prediction-club/db';
import { processVaultEvent } from './events';
import { INDEXER_CONFIG } from './config';

interface BackfillArgs {
  club?: string;
  from?: string;
  to?: string;
}

function parseArgs(): BackfillArgs {
  const args: BackfillArgs = {};

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--club' && process.argv[i + 1]) {
      args.club = process.argv[++i];
    } else if (arg === '--from' && process.argv[i + 1]) {
      args.from = process.argv[++i];
    } else if (arg === '--to' && process.argv[i + 1]) {
      args.to = process.argv[++i];
    }
  }

  return args;
}

async function backfill() {
  const args = parseArgs();

  if (!args.club) {
    console.error('Usage: yarn indexer:backfill --club <slug> --from <block> [--to <block>]');
    process.exit(1);
  }

  // Find club
  const club = await prisma.club.findUnique({
    where: { slug: args.club },
  });

  if (!club) {
    console.error(`Club not found: ${args.club}`);
    process.exit(1);
  }

  console.log(`Backfilling club: ${club.name} (${club.slug})`);
  console.log(`Vault address: ${club.vaultAddress}`);
  console.log(`Chain ID: ${club.chainId}`);

  const client = createChainPublicClient(club.chainId as SupportedChainId);
  const currentBlock = await client.getBlockNumber();

  const fromBlock = args.from ? BigInt(args.from) : currentBlock - 100000n;
  const toBlock = args.to ? BigInt(args.to) : currentBlock;

  console.log(`From block: ${fromBlock}`);
  console.log(`To block: ${toBlock}`);
  console.log('');

  const batchSize = BigInt(INDEXER_CONFIG.batchSize);
  let processedEvents = 0;

  for (let batch = fromBlock; batch <= toBlock; batch += batchSize) {
    const batchEnd = batch + batchSize - 1n > toBlock ? toBlock : batch + batchSize - 1n;

    console.log(`Processing blocks ${batch} to ${batchEnd}...`);

    const logs = await client.getLogs({
      address: club.vaultAddress as `0x${string}`,
      events: ClubVaultV1Abi.filter((item) => item.type === 'event'),
      fromBlock: batch,
      toBlock: batchEnd,
    });

    console.log(`Found ${logs.length} events`);

    for (const log of logs) {
      const block = await client.getBlock({ blockNumber: log.blockNumber! });
      const blockTime = new Date(Number(block.timestamp) * 1000);

      await processVaultEvent(club.id, log, blockTime);
      processedEvents++;
    }
  }

  console.log('');
  console.log(`Backfill complete. Processed ${processedEvents} events.`);
}

backfill()
  .catch((error) => {
    console.error('Backfill error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
