import { NextRequest } from 'next/server';
import { ClubController, ClubError } from '@/controllers';
import {
  apiError,
  apiResponse,
  forbiddenError,
  notFoundError,
  serverError,
  unauthorizedError,
} from '@/lib/api';
import { AuthError, requireAuth } from '@/lib/auth';
import { ClubWalletTradingError, enableClubWalletTrading } from '@/lib/club-wallet-trading';
import { prisma } from '@prediction-club/db';

function createFlowId() {
  return `enable_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const flowId = createFlowId();
  const startedAtMs = Date.now();
  try {
    const user = await requireAuth(request);
    const club = await ClubController.getBySlug(params.slug);
    const member = club.members.find((clubMember) => clubMember.userId === user.id);
    if (!member || member.status !== 'ACTIVE') {
      return forbiddenError('You must be an active member to enable trading');
    }

    if (!user.turnkeySubOrgId) {
      return apiError('TURNKEY_SUBORG_REQUIRED', 'Sign in with Turnkey before enabling trading', 400);
    }

    const wallet = await prisma.clubWallet.findUnique({
      where: {
        userId_clubId: {
          userId: user.id,
          clubId: club.id,
        },
      },
      select: {
        id: true,
        walletAddress: true,
        turnkeyWalletAccountId: true,
        isDisabled: true,
        createdAt: true,
      },
    });
    if (!wallet) {
      return apiError('WALLET_NOT_FOUND', 'Initialize your club wallet before enabling trading', 400);
    }
    if (wallet.isDisabled) {
      return apiError('WALLET_DISABLED', 'Club wallet is disabled', 400);
    }

    console.info('[wallet-enable-trading]', {
      event: 'route.start',
      flowId,
      clubId: club.id,
      userId: user.id,
      walletAddress: wallet.walletAddress,
    });

    const result = await enableClubWalletTrading({
      organizationId: user.turnkeySubOrgId,
      walletAccountId: wallet.turnkeyWalletAccountId,
      walletAddress: wallet.walletAddress,
      logContext: {
        flowId,
        clubId: club.id,
        userId: user.id,
      },
    });

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        userId: user.id,
        clubId: club.id,
        safeAddress: wallet.walletAddress,
      },
      select: {
        amount: true,
      },
    });
    const balance = ledgerEntries.reduce((sum, entry) => sum + BigInt(entry.amount), 0n).toString();

    console.info('[wallet-enable-trading]', {
      event: 'route.complete',
      flowId,
      clubId: club.id,
      userId: user.id,
      txCount: result.txHashes.length,
      ready: result.status.ready,
      durationMs: Date.now() - startedAtMs,
    });

    return apiResponse({
      txHashes: result.txHashes,
      wallet: {
        id: wallet.id,
        walletAddress: wallet.walletAddress,
        turnkeyWalletAccountId: wallet.turnkeyWalletAccountId,
        isDisabled: wallet.isDisabled,
        createdAt: wallet.createdAt,
        automationReady: result.status.ready,
        balance,
      },
    });
  } catch (error) {
    console.error('[wallet-enable-trading]', {
      event: 'route.error',
      flowId,
      slug: params.slug,
      durationMs: Date.now() - startedAtMs,
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    if (error instanceof ClubError) {
      return notFoundError('Club');
    }
    if (error instanceof ClubWalletTradingError) {
      return apiError(error.code, error.message, 400);
    }
    return serverError();
  }
}
