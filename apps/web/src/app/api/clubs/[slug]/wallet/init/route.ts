import { NextRequest } from 'next/server';
import { ClubController, ClubError, ClubWalletController, ClubWalletError } from '@/controllers';
import {
  apiError,
  apiResponse,
  forbiddenError,
  notFoundError,
  serverError,
  unauthorizedError,
} from '@/lib/api';
import { AuthError, requireAuth } from '@/lib/auth';
import { getClubWalletTradingStatus } from '@/lib/club-wallet-trading';

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const user = await requireAuth(request);
    const club = await ClubController.getBySlug(params.slug);

    const member = club.members.find((clubMember) => clubMember.userId === user.id);
    if (!member || member.status !== 'ACTIVE') {
      return forbiddenError('You must be an active member to initialize a club wallet');
    }

    const wallet = await ClubWalletController.ensureClubWallet({
      userId: user.id,
      clubId: club.id,
    });

    let tradingReady = false;
    try {
      const tradingStatus = await getClubWalletTradingStatus({
        walletAddress: wallet.walletAddress,
      });
      tradingReady = tradingStatus.ready;
    } catch (error) {
      console.warn('Unable to load club wallet trading status:', error);
    }

    return apiResponse({
      wallet: {
        id: wallet.id,
        walletAddress: wallet.walletAddress,
        isDisabled: wallet.isDisabled,
        turnkeyWalletAccountId: wallet.turnkeyWalletAccountId,
        createdAt: wallet.createdAt,
        automationReady: tradingReady,
        balance: '0',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    if (error instanceof ClubWalletError) {
      return apiError(error.code, error.message, 400);
    }
    if (error instanceof ClubError) {
      return notFoundError('Club');
    }
    console.error('Error initializing club wallet:', error);
    return serverError();
  }
}
