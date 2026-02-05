import path from 'path';
import { config as loadEnv } from 'dotenv';
import type { PrismaClient } from '@prediction-club/db';

const localEnvPath = path.resolve(process.cwd(), '.env');
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
loadEnv({ path: localEnvPath });
loadEnv({ path: rootEnvPath });

const requiredEnvVars = [
  'DATABASE_URL',
  'CHAINWORKER_SIGNER_PRIVATE_KEY',
  'POLY_BUILDER_API_KEY',
  'POLY_BUILDER_SECRET',
  'POLY_BUILDER_PASSPHRASE',
] as const;

function assertCriticalEnv() {
  const missing = requiredEnvVars.filter((name) => {
    const value = process.env[name];
    return !value || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(
      `[chainworker] Missing required env vars: ${missing.join(
        ', '
      )}. Set them in apps/chainworker/.env (or the root .env) and restart.`
    );
  }
}

assertCriticalEnv();

function readPositiveNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    console.warn(`[chainworker] Invalid ${name}="${raw}". Using ${fallback}.`);
    return fallback;
  }
  return value;
}

const pollIntervalMs = readPositiveNumber('CHAINWORKER_POLL_INTERVAL_MS', 30_000);
const batchSize = readPositiveNumber('CHAINWORKER_BATCH_SIZE', 25);

let prisma: PrismaClient;
let ChainWorkerDBController: (typeof import('./controllers/ChainWorkerDBController'))['ChainWorkerDBController'];
let PolymarketController: (typeof import('./controllers/PolymarketController'))['PolymarketController'];

async function initDeps() {
  const db = await import('@prediction-club/db');
  prisma = db.prisma;
  ({ ChainWorkerDBController } = await import('./controllers/ChainWorkerDBController'));
  ({ PolymarketController } = await import('./controllers/PolymarketController'));
}

const shutdownState = { requested: false };

function requestShutdown(signal: string) {
  if (shutdownState.requested) return;
  shutdownState.requested = true;
  console.log(`[chainworker] Received ${signal}, shutting down...`);
}

process.on('SIGINT', () => requestShutdown('SIGINT'));
process.on('SIGTERM', () => requestShutdown('SIGTERM'));

async function runOnce() {
  const executionRounds = await ChainWorkerDBController.listRoundsToExecute(batchSize);
  if (executionRounds.length > 0) {
    for (const round of executionRounds) {
      if (shutdownState.requested) break;
      if (!round.targetTokenId) {
        console.error(
          `[chainworker] Round ${round.id} missing targetTokenId; cannot execute.`
        );
        continue;
      }

      try {
        const members = await ChainWorkerDBController.getRoundMembers(round.id);
        const invalidMembers = members
          .map((member) => ({
            member,
            missing: PolymarketController.missingMemberFields(member),
          }))
          .filter((entry) => entry.missing.length > 0);
        if (invalidMembers.length > 0) {
          const details = invalidMembers
            .map(
              ({ member, missing }) =>
                `${member.userId} (${missing.join(', ')})`
            )
            .join('; ');
          console.error(
            `[chainworker] Round ${round.id} missing required Polymarket fields: ${details}`
          );
          continue;
        }

        let allSucceeded = true;
        for (const member of members) {
          if (member.orderId) {
            continue;
          }
          try {
            const order = await PolymarketController.placeMarketOrder({
              tokenId: round.targetTokenId,
              commitAmount: member.commitAmount,
              member,
            });
            await ChainWorkerDBController.updateMemberOrder(member.id, order);
            member.orderId = order.orderId;
          } catch (error) {
            allSucceeded = false;
            console.error(
              `[chainworker] Round ${round.id} order failed for member ${member.userId}:`,
              error
            );
          }
        }

        const pendingMembers = members.filter((member) => !member.orderId);
        if (pendingMembers.length === 0 && allSucceeded) {
          await ChainWorkerDBController.markRoundCommitted(round.id);
          console.log(`[chainworker] Round ${round.id} committed.`);
        }
      } catch (error) {
        console.error(`[chainworker] Round ${round.id} execution failed:`, error);
      }
    }
  }

  const rounds = await ChainWorkerDBController.listRoundsToSettle(batchSize);
  if (rounds.length === 0) {
    console.log('[chainworker] No committed rounds found.');
    return;
  }

  for (const round of rounds) {
    if (shutdownState.requested) break;
    try {
      const resolution = round.resolvedAt
        ? { isResolved: true, outcome: round.outcome, resolvedAt: round.resolvedAt }
        : await PolymarketController.fetchMarketResolution(round.conditionId);

      if (!resolution.isResolved) {
        console.log(
          `[chainworker] Round ${round.id} unresolved for ${round.conditionId}`
        );
        continue;
      }

      const members = await ChainWorkerDBController.getRoundMembers(round.id);
      const payouts = PolymarketController.computeMemberPayouts(members);
      if (!payouts) {
        console.log(`[chainworker] Round ${round.id} missing payout data.`);
        continue;
      }

      await ChainWorkerDBController.settleRound(round, members, payouts, {
        outcome: resolution.outcome ?? null,
        resolvedAt: resolution.resolvedAt ?? null,
      });

      console.log(`[chainworker] Round ${round.id} settled.`);
    } catch (error) {
      console.error(`[chainworker] Round ${round.id} failed to settle:`, error);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  await initDeps();
  console.log('[chainworker] Starting settlement poller.');
  console.log(`[chainworker] Poll interval ${pollIntervalMs}ms, batch size ${batchSize}.`);

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
