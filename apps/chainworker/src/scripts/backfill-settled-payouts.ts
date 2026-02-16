import fs from 'fs';
import path from 'path';
import { config as loadDotEnv } from 'dotenv';
import { prisma } from '@prediction-club/db';
import { pendingRoundSelect } from '../types/chainworker-db';
import { ChainWorkerDBController } from '../controllers/ChainWorkerDBController';
import { PolymarketController } from '../controllers/PolymarketController';

type CliArgs = Record<string, string | boolean>;

function loadEnv() {
  const cwd = process.cwd();
  const fallbackCandidates = [path.resolve(cwd, '../../.env'), path.resolve(cwd, '../web/.env')];
  const loaded = new Set<string>();

  for (const candidate of fallbackCandidates) {
    if (!fs.existsSync(candidate)) continue;
    if (loaded.has(candidate)) continue;
    loadDotEnv({ path: candidate, override: false });
    loaded.add(candidate);
  }

  const chainworkerEnv = path.resolve(cwd, '.env');
  if (fs.existsSync(chainworkerEnv)) {
    loadDotEnv({ path: chainworkerEnv, override: true });
  }
}

function parseArgs(argv = process.argv.slice(2)): CliArgs {
  const args: CliArgs = {};
  for (const rawArg of argv) {
    if (!rawArg.startsWith('--')) continue;
    const body = rawArg.slice(2);
    const eq = body.indexOf('=');
    if (eq < 0) {
      args[body] = true;
      continue;
    }
    const key = body.slice(0, eq);
    const value = body.slice(eq + 1);
    args[key] = value;
  }
  return args;
}

function getOptionalStringArg(args: CliArgs, key: string): string | null {
  const value = args[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const args = parseArgs();
  const clubSlug = getOptionalStringArg(args, 'club-slug');

  const rounds = await prisma.predictionRound.findMany({
    where: {
      status: 'SETTLED',
      ...(clubSlug ? { club: { slug: clubSlug } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: pendingRoundSelect,
  });

  console.log(
    `[chainworker] Backfill scan starting. settledRounds=${rounds.length}${clubSlug ? ` club=${clubSlug}` : ''}`
  );

  let changedRounds = 0;
  let updatedMembers = 0;
  let createdPayoutEntries = 0;

  for (const round of rounds) {
    const members = await ChainWorkerDBController.getRoundMembers(round.id);
    const payouts = PolymarketController.computeMemberPayouts(round, members);
    if (!payouts) continue;

    const syncResult = await ChainWorkerDBController.syncSettledRoundPayouts(round, members, payouts);
    if (syncResult.updatedMembers > 0 || syncResult.createdPayoutEntries > 0) {
      changedRounds += 1;
      updatedMembers += syncResult.updatedMembers;
      createdPayoutEntries += syncResult.createdPayoutEntries;
      console.log('[chainworker] Backfilled settled round', {
        roundId: round.id,
        marketSlug: round.marketSlug,
        updatedMembers: syncResult.updatedMembers,
        createdPayoutEntries: syncResult.createdPayoutEntries,
      });
    }
  }

  console.log('[chainworker] Backfill complete', {
    scannedRounds: rounds.length,
    changedRounds,
    updatedMembers,
    createdPayoutEntries,
  });
}

main()
  .catch((error) => {
    console.error('[chainworker] Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
