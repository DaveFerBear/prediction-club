import path from 'path';
import { config as loadEnv } from 'dotenv';
import type { PrismaClient } from '@prediction-club/db';

const localEnvPath = path.resolve(process.cwd(), '.env');
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
const webEnvPath = path.resolve(process.cwd(), '../web/.env');
loadEnv({ path: localEnvPath });
loadEnv({ path: rootEnvPath });
loadEnv({ path: webEnvPath });

const requiredEnvVars = [
  'DATABASE_URL',
  'TURNKEY_API_PUBLIC_KEY',
  'TURNKEY_API_PRIVATE_KEY',
  'POLY_BUILDER_API_KEY',
  'POLY_BUILDER_SECRET',
  'POLY_BUILDER_PASSPHRASE',
  'POLYMARKET_RELAYER_URL',
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
        console.error(`[chainworker] Round ${round.id} missing targetTokenId; cannot execute.`);
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
            .map(({ member, missing }) => `${member.userId} (${missing.join(', ')})`)
            .join('; ');
          await ChainWorkerDBController.markRoundCancelled(round.id);
          console.warn(
            `[chainworker] Round ${round.id} cancelled due to missing execution prerequisites: ${details}`
          );
          continue;
        }

        let allSucceeded = true;
        let placedOrderThisRun = false;
        let cancelPendingRoundReason: string | null = null;
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
            placedOrderThisRun = true;
          } catch (error) {
            allSucceeded = false;
            console.error(
              `[chainworker] Round ${round.id} order failed for member ${member.userId}:`,
              error
            );

            if (
              !placedOrderThisRun &&
              members.every((candidate) => !candidate.orderId) &&
              PolymarketController.isNoMatchOrderError(error)
            ) {
              cancelPendingRoundReason =
                'order book had no fillable liquidity (no match) before first execution';
              break;
            }
          }
        }

        if (cancelPendingRoundReason) {
          await ChainWorkerDBController.cancelRoundAndRevertCommits(
            round.id,
            cancelPendingRoundReason
          );
          console.warn(
            `[chainworker] Round ${round.id} cancelled and commits reversed: ${cancelPendingRoundReason}`
          );
          continue;
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

  const roundsToResolve = await ChainWorkerDBController.listRoundsToResolve(batchSize);
  for (const round of roundsToResolve) {
    if (shutdownState.requested) break;
    try {
      const resolution = await PolymarketController.fetchMarketResolution(round.conditionId);

      if (!resolution.isResolved) {
        console.log(`[chainworker] Round ${round.id} unresolved for ${round.conditionId}`);
        continue;
      }

      const resolvedOutcome = resolution.outcome ?? round.outcome ?? null;
      if (!resolvedOutcome) {
        console.warn(
            `[chainworker] Round ${round.id} resolved without outcome for ${round.conditionId}; skipping settlement until outcome is available.`
        );
        continue;
      }

      await ChainWorkerDBController.markRoundResolved(round.id, {
        outcome: resolvedOutcome,
        resolvedAt: resolution.resolvedAt ?? null,
      });
      console.log(`[chainworker] Round ${round.id} resolved.`);
    } catch (error) {
      console.error(`[chainworker] Round ${round.id} failed to resolve:`, error);
    }
  }

  const roundsToRedeem = await ChainWorkerDBController.listRoundsToRedeem(batchSize);
  if (executionRounds.length === 0 && roundsToResolve.length === 0 && roundsToRedeem.length === 0) {
    console.log('[chainworker] No actionable rounds found.');
    return;
  }

  for (const round of roundsToRedeem) {
    if (shutdownState.requested) break;
    try {
      const resolution = await PolymarketController.fetchMarketResolutionDetails(round.conditionId);
      if (!resolution.isResolved) {
        console.log(`[chainworker] Round ${round.id} unresolved for ${round.conditionId}`);
        continue;
      }

      const resolvedOutcome = resolution.outcome ?? round.outcome ?? null;
      if (!resolvedOutcome) {
        console.warn(
          `[chainworker] Round ${round.id} resolved without outcome for ${round.conditionId}; skipping redemption until outcome is available.`
        );
        continue;
      }

      const members = await ChainWorkerDBController.getRoundMembers(round.id);
      if (members.length === 0) {
        console.log(`[chainworker] Round ${round.id} has no members to settle.`);
        continue;
      }

      if (!PolymarketController.isWinningResolution(round, resolution)) {
        const payouts = members.map((member) => ({
          userId: member.userId,
          payoutAmount: '0',
          redeemedAmount: '0',
          pnlAmount: (0n - BigInt(member.commitAmount)).toString(),
        }));
        await ChainWorkerDBController.settleRound(
          round,
          members,
          payouts,
          {
            outcome: resolvedOutcome,
            resolvedAt: resolution.resolvedAt ?? null,
          },
          { payoutSource: 'polymarket-zero-payout' }
        );
        console.log(`[chainworker] Round ${round.id} settled with zero payout.`);
        continue;
      }

      const payouts = [];
      for (const member of members) {
        const redemption = await PolymarketController.redeemWinningPosition({
          round,
          member,
          resolution,
        });

        if (!redemption) {
          throw new Error(
            `Winning round ${round.id} has no redeemable position balance for member ${member.userId}`
          );
        }

        payouts.push({
          userId: member.userId,
          payoutAmount: redemption.payoutAmount,
          redeemedAmount: redemption.payoutAmount,
          pnlAmount: (BigInt(redemption.payoutAmount) - BigInt(member.commitAmount)).toString(),
          redemptionTxHash: redemption.redemptionTxHash,
          redeemedAt: redemption.redeemedAt,
        });
      }

      await ChainWorkerDBController.settleRound(
        round,
        members,
        payouts,
        {
          outcome: resolvedOutcome,
          resolvedAt: resolution.resolvedAt ?? null,
        },
        { payoutSource: 'polymarket-redemption' }
      );

      console.log(`[chainworker] Round ${round.id} settled.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ChainWorkerDBController.markRoundRedemptionError(round.id, message);
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
