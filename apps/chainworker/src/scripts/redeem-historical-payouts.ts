import fs from 'fs';
import path from 'path';
import { config as loadDotEnv } from 'dotenv';

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

function getOptionalNumberArg(args: CliArgs, key: string): number | null {
  const value = args[key];
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const [{ prisma }, { pendingRoundSelect }, { ChainWorkerDBController }, { PolymarketController }] =
    await Promise.all([
      import('@prediction-club/db'),
      import('../types/chainworker-db'),
      import('../controllers/ChainWorkerDBController'),
      import('../controllers/PolymarketController'),
    ]);

  const args = parseArgs();
  const clubSlug = getOptionalStringArg(args, 'club-slug');
  const roundId = getOptionalStringArg(args, 'round-id');
  const limit = getOptionalNumberArg(args, 'limit');
  const dryRun = args['dry-run'] === true;

  const rounds = await prisma.predictionRound.findMany({
    where: {
      status: { in: ['SETTLED', 'RESOLVED'] },
      resolvedAt: { not: null },
      ...(clubSlug ? { club: { slug: clubSlug } } : {}),
      ...(roundId ? { id: roundId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: limit ?? undefined,
    select: pendingRoundSelect,
  });

  console.log(
    `[chainworker] Historical redemption scan starting. rounds=${rounds.length}${clubSlug ? ` club=${clubSlug}` : ''}${roundId ? ` round=${roundId}` : ''}${dryRun ? ' dryRun=true' : ''}`
  );

  let repairedRounds = 0;
  let skippedRounds = 0;
  let failedRounds = 0;

  for (const round of rounds) {
    try {
      const resolution = await PolymarketController.fetchMarketResolutionDetails(round.conditionId);
      if (!resolution.isResolved || !resolution.outcome) {
        skippedRounds += 1;
        continue;
      }

      if (!PolymarketController.isWinningResolution(round, resolution)) {
        skippedRounds += 1;
        continue;
      }

      const members = await ChainWorkerDBController.getRoundMembers(round.id);
      if (members.length === 0) {
        skippedRounds += 1;
        continue;
      }

      const balances = await Promise.all(
        members.map(async (member) => ({
          member,
          balance: await PolymarketController.getWinningPositionBalance({ round, member }),
        })),
      );

      if (balances.some((entry) => entry.balance <= 0n)) {
        console.log('[chainworker] Historical redemption skip (missing redeemable balance)', {
          roundId: round.id,
          members: balances.map((entry) => ({
            userId: entry.member.userId,
            balance: entry.balance.toString(),
          })),
        });
        skippedRounds += 1;
        continue;
      }

      if (dryRun) {
        console.log('[chainworker] Historical redemption eligible', {
          roundId: round.id,
          marketSlug: round.marketSlug,
          members: balances.map((entry) => ({
            userId: entry.member.userId,
            balance: entry.balance.toString(),
          })),
        });
        continue;
      }

      const payouts = [];
      for (const { member } of balances) {
        const redemption = await PolymarketController.redeemWinningPosition({
          round,
          member,
          resolution,
        });
        if (!redemption) {
          throw new Error(
            `Round ${round.id} became non-redeemable mid-run for member ${member.userId}`,
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
          outcome: resolution.outcome,
          resolvedAt: resolution.resolvedAt,
        },
        {
          replaceExistingPayouts: true,
          payoutSource: 'polymarket-redemption-repair',
        },
      );

      repairedRounds += 1;
      console.log('[chainworker] Historical redemption repaired round', {
        roundId: round.id,
        marketSlug: round.marketSlug,
        members: payouts.map((entry) => ({
          userId: entry.userId,
          payoutAmount: entry.payoutAmount,
          txHash: entry.redemptionTxHash,
        })),
      });
    } catch (error) {
      failedRounds += 1;
      const message = error instanceof Error ? error.message : String(error);
      await ChainWorkerDBController.markRoundRedemptionError(round.id, message);
      console.error('[chainworker] Historical redemption round failed', {
        roundId: round.id,
        marketSlug: round.marketSlug,
        error: message,
      });
    }
  }

  console.log('[chainworker] Historical redemption complete', {
    scannedRounds: rounds.length,
    repairedRounds,
    skippedRounds,
    failedRounds,
    dryRun,
  });
}

main()
  .catch((error) => {
    console.error('[chainworker] Historical redemption failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import('@prediction-club/db');
    await prisma.$disconnect();
  });
