import path from 'path';
import { config as loadEnv } from 'dotenv';
import type { PrismaClient } from '@prediction-club/db';

const localEnvPath = path.resolve(process.cwd(), '.env');
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
loadEnv({ path: localEnvPath });
loadEnv({ path: rootEnvPath });

const pollIntervalMs = Number(process.env.CHAINWORKER_POLL_INTERVAL_MS ?? 30_000);
const batchSize = Number(process.env.CHAINWORKER_BATCH_SIZE ?? 25);

let prisma: PrismaClient;

async function initPrisma() {
  const db = await import('@prediction-club/db');
  prisma = db.prisma;
}

type PendingRound = {
  id: string;
  clubId: string;
  marketRef: string | null;
  createdAt: Date;
};

const shutdownState = { requested: false };

function requestShutdown(signal: string) {
  if (shutdownState.requested) return;
  shutdownState.requested = true;
  console.log(`[chainworker] Received ${signal}, shutting down...`);
}

process.on('SIGINT', () => requestShutdown('SIGINT'));
process.on('SIGTERM', () => requestShutdown('SIGTERM'));

async function fetchPendingRounds(): Promise<PendingRound[]> {
  return prisma.predictionRound.findMany({
    where: { status: 'COMMITTED' },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
    select: {
      id: true,
      clubId: true,
      marketRef: true,
      createdAt: true,
    },
  });
}

async function handleRound(round: PendingRound) {
  // TODO: fetch resolution + fills from Polymarket (CLOB/relay) and update:
  // - PredictionRound status/outcome timestamps
  // - PredictionRoundMember payouts + pnl
  // - LedgerEntry PAYOUT rows per member
  console.log(
    `[chainworker] Round ${round.id} (club ${round.clubId}) awaiting settlement for ${round.marketRef ?? 'unknown market'}`
  );
}

async function runOnce() {
  const rounds = await fetchPendingRounds();
  if (rounds.length === 0) {
    console.log('[chainworker] No committed rounds found.');
    return;
  }

  for (const round of rounds) {
    if (shutdownState.requested) break;
    await handleRound(round);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  await initPrisma();
  console.log('[chainworker] Starting settlement poller.');
  console.log(
    `[chainworker] Poll interval ${pollIntervalMs}ms, batch size ${batchSize}.`
  );

  while (!shutdownState.requested) {
    const startedAt = Date.now();
    try {
      await runOnce();
    } catch (error) {
      console.error('[chainworker] Polling error:', error);
    }

    const elapsed = Date.now() - startedAt;
    const delay = Math.max(0, pollIntervalMs - elapsed);
    if (delay > 0) {
      await sleep(delay);
    }
  }

  await prisma.$disconnect();
  console.log('[chainworker] Shutdown complete.');
}

void run();
